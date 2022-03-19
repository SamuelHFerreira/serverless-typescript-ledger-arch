import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Duration } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

class StateMachineGenerator {
  readonly context: Construct;
  readonly sourceDir: string;

  constructor(context: Construct, sourceDir: string) {
    this.context = context;
  }

  public createStateMachine() {
    // Flow that may be repeated by each sync job* entrypoint
    let entryFlowLambda = new lambda.Function(this.context, 'entryFLowLambdaHandler', {
      runtime: lambda.Runtime.NODEJS_14_X,
      code: lambda.Code.fromAsset(this.sourceDir),
      handler: 'entryPoint.handler',
    });

    // Step functions are built up of steps, we need to define our first step
    const entryPointJob = new tasks.LambdaInvoke(this.context, 'Entry Point Job', {
      lambdaFunction: entryFlowLambda,
      inputPath: '$.booleanOrder',
      resultPath: '$.entryPointAnalysisResult',
      payloadResponseOnly: true,
    });

    // Failure step defined
    const failStep = new sfn.Fail(this.context, 'Sorry, Failure on Execute Entrypoint', {
      cause: 'Error Cause',
      error: 'Error Description',
    });

    // Defined Success
    const successStep = new sfn.Succeed(this.context, 'Lets make successStep', {
      outputPath: '$.entryPointAnalysisResult',
    });

    //Express Step function definition
    const definition = sfn.Chain.start(entryPointJob).next(
      new sfn.Choice(this.context, 'With Choice?') // Logical choice added to flow
        // Look at the "status" field
        .when(sfn.Condition.booleanEquals('$.entryPointAnalysisResult.containsFailure', true), failStep) // Fail First
        .otherwise(successStep)
    );

    let stateMachine = new sfn.StateMachine(this.context, 'StateMachine', {
      definition,
      timeout: Duration.minutes(5),
      tracingEnabled: true,
      stateMachineType: sfn.StateMachineType.EXPRESS,
    });
  }
}
