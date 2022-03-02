import { Stack, StackProps, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
// import { Effect, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';

export class MastersOfMultiverseStack extends Stack {

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
  
    // Flow that may be repeated by each entrypoint

    let entryFlowLambda = new lambda.Function(this, 'entryFLowLambdaHandler', {
      runtime: lambda.Runtime.NODEJS_12_X,
      code: lambda.Code.fromAsset('lambda-fns'),
      handler: 'entryPoint.handler'
    });

    // Step functions are built up of steps, we need to define our first step
    const entryPointJob = new tasks.LambdaInvoke(this, "Entry Point Job", {
      lambdaFunction: entryFlowLambda,
      inputPath: '$.booleanOrder',
      resultPath: '$.entryPointAnalysisResult',
      payloadResponseOnly: true
    })

    // Failure step defined
    const failStep = new sfn.Fail(this, 'Sorry, Failure on Execute Entrypoint', {
      cause: 'Error Cause',
      error: 'Error Description',
    });

    // Defined Success
    const successStep = new sfn.Succeed(this, 'Lets make successStep', {
      outputPath: '$.entryPointAnalysisResult'
    });

    //Express Step function definition
    const definition = sfn.Chain
    .start(entryPointJob)
    .next(new sfn.Choice(this, 'With Choice?') // Logical choice added to flow
        // Look at the "status" field
        .when(sfn.Condition.booleanEquals('$.entryPointAnalysisResult.containsFailure', true), failStep) // Fail First
        .otherwise(successStep));

    let stateMachine = new sfn.StateMachine(this, 'StateMachine', {
      definition,
      timeout: Duration.minutes(5),
      tracingEnabled: true,
      stateMachineType: sfn.StateMachineType.EXPRESS
    });
    

    //======  Endpoint Action is defined!!

    const api = new apigateway.StepFunctionsRestApi(this, 'StepFunctionsRestApi', {
      deploy: true,
      stateMachine: stateMachine,
    });



    // const v1 = api.root.addResource('v1');
    // const echo = v1.addResource('user');
    // const echoMethod = echo.addMethod('GET', stateMachine, { apiKeyRequired: true });

    
  }
}
