import { Stack, StackProps, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { OpenAPIV3 } from 'openapi-types';
import * as YAML from 'yaml';
import * as fs from 'fs';

export type IntegrationAddons = {
  [xHeaderId: string]: IntegrationAddon & unknown;
};

export type IntegrationAddon = {
  uri: string;
  type: string;
  httpMethod: string;
  connectionType: string;
};

export class MastersOfMultiverseStack extends Stack {
  public readonly openApiSpec: {
    info: {
      title: string;
      [otherInfo: string]: unknown;
    };
    paths: {
      [path: string]: OpenAPIV3.PathItemObject & { [attr: string]: unknown };
    };
    components?: {
      securitySchemes?: OpenAPIV3.HttpSecurityScheme & {
        [attr: string]: unknown;
      };
      schemas?: {
        [attr: string]: unknown;
      };
      [attr: string]: unknown;
    };
    [attr: string]: unknown;
  };

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    let sourceDir = 'src';

    const openApiYaml = fs.readFileSync('specs/Masters-Of-Multiverse.yaml', 'utf-8');
    this.openApiSpec = YAML.parse(openApiYaml);

    const getUserHandler: lambda.Function = new lambda.Function(this, 'GetUserLambdaHandler', {
      runtime: lambda.Runtime.NODEJS_14_X,
      code: lambda.Code.fromAsset(sourceDir),
      handler: 'operations/getUser.handler',
      timeout: Duration.seconds(10),
    });
    getUserHandler.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));

    const createUserHandler: lambda.Function = new lambda.Function(this, 'CreateUserLambdaHandler', {
      runtime: lambda.Runtime.NODEJS_14_X,
      code: lambda.Code.fromAsset(sourceDir),
      handler: 'operations/postUser.handler',
      timeout: Duration.seconds(10),
    });
    createUserHandler.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));

    // TODO assign automatically by name pattern.
    this.customizeSpecToLambdaHandling(getUserHandler, '/users/{userId}', OpenAPIV3.HttpMethods.GET);
    this.customizeSpecToLambdaHandling(createUserHandler, '/user', OpenAPIV3.HttpMethods.POST);

    const apiDefinition = apigateway.ApiDefinition.fromInline(this.openApiSpec);

    const specRestApiProps = {
      apiDefinition,
      deployOptions: {
        tracingEnabled: true,
      },
    };

    const api = new apigateway.SpecRestApi(this, 'MastersOfMultiverseAPI', specRestApiProps);
  }

  private customizeSpecToLambdaHandling(lambda: lambda.Function, pathToApply: string, methodToApply: string) {
    const pathsMethods = Object.keys(this.openApiSpec.paths).map((specPath) => {
      if (specPath == pathToApply) {
        this.applyMethodHandling(
          methodToApply,
          this.openApiSpec.paths[specPath],
          this.getIntegrationUri(lambda.functionArn)
        );
      }
    });
  }

  private applyMethodHandling(
    operationToApply: string,
    pathSpec: { [attr: string]: unknown },
    lambdaIntegrationUri: string
  ) {
    return Object.keys(pathSpec)
      .filter((method) => (<any>Object).values(OpenAPIV3.HttpMethods).includes(method) && method == operationToApply)
      .map((method) => {
        let operation = pathSpec[method] as { [attr: string]: unknown };
        this.addIntegrationToOperation( operation, lambdaIntegrationUri);
      });
  }

  private addIntegrationToOperation(operation: { [attr: string]: unknown }, lambdaIntegrationUri: string) {
    operation['x-amazon-apigateway-integration'] = {
      uri: lambdaIntegrationUri,
      type: 'aws_proxy',
      httpMethod: 'POST',
      connectionType: 'INTERNET',
    };
  }

  private getIntegrationUri(functionArn?: string): string {
    return `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${functionArn}/invocations`;
  }
}
