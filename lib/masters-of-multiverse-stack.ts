import { Stack, StackProps, Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from 'path';
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
// import { Effect, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';

export class MastersOfMultiverseStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    let sourceDir = "src";

    // Flow that may be repeated by each sync job* entrypoint

    let entryFlowLambda = new lambda.Function(this, "entryFLowLambdaHandler", {
      runtime: lambda.Runtime.NODEJS_14_X,
      code: lambda.Code.fromAsset(sourceDir),
      handler: "entryPoint.handler",
    });

    // Step functions are built up of steps, we need to define our first step
    const entryPointJob = new tasks.LambdaInvoke(this, "Entry Point Job", {
      lambdaFunction: entryFlowLambda,
      inputPath: "$.booleanOrder",
      resultPath: "$.entryPointAnalysisResult",
      payloadResponseOnly: true,
    });

    // Failure step defined
    const failStep = new sfn.Fail(
      this,
      "Sorry, Failure on Execute Entrypoint",
      {
        cause: "Error Cause",
        error: "Error Description",
      }
    );

    // Defined Success
    const successStep = new sfn.Succeed(this, "Lets make successStep", {
      outputPath: "$.entryPointAnalysisResult",
    });

    //Express Step function definition
    const definition = sfn.Chain.start(entryPointJob).next(
      new sfn.Choice(this, "With Choice?") // Logical choice added to flow
        // Look at the "status" field
        .when(
          sfn.Condition.booleanEquals(
            "$.entryPointAnalysisResult.containsFailure",
            true
          ),
          failStep
        ) // Fail First
        .otherwise(successStep)
    );

    let stateMachine = new sfn.StateMachine(this, "StateMachine", {
      definition,
      timeout: Duration.minutes(5),
      tracingEnabled: true,
      stateMachineType: sfn.StateMachineType.EXPRESS,
    });

    //======  Endpoint Action is defined!!
    const api = new apigateway.RestApi(this, "StepFunctionsRestApi", {
      deploy: true,
      restApiName: "MastersAPI",
    });

    const userModel: apigateway.Model = api.addModel("UserModel", {
      schema: {
        type: apigateway.JsonSchemaType.OBJECT,
        properties: {
          userId: {
            type: apigateway.JsonSchemaType.STRING,
          },
          name: {
            type: apigateway.JsonSchemaType.STRING,
          },
        },
        required: ["userId"],
      },
    });

    let v1 = api.root.addResource("v1");
    let userResource = v1.addResource("user");
    userResource.addMethod(
      "POST",
      apigateway.StepFunctionsIntegration.startExecution(stateMachine),
      {
        apiKeyRequired: false,
        requestModels: {
          "application/json": userModel,
        },
      }
    );

    const handler: lambda.Function = new lambda.Function(this, 'GetUserLambdaHandler', {
      runtime: lambda.Runtime.NODEJS_14_X,
      code: lambda.Code.fromAsset(sourceDir),
      handler: 'getUser.handler',
      timeout: Duration.seconds(10)
    });

    userResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(handler)
    );
  }
}
