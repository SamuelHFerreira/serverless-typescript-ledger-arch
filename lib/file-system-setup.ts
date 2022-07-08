import * as efs from 'aws-cdk-lib/aws-efs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as path from 'path';
import { Construct } from 'constructs';
import { AccessPoint } from 'aws-cdk-lib/aws-efs';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export interface SetupProps {
  filesPath?: string;
}

export class FileSystemSetup extends Construct {
  private readonly filesPath: string;
  public readonly accessPoint: AccessPoint;
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props: SetupProps) {
    super(scope, id);
    this.filesPath = props.filesPath ?? '/export/lambda';

    const vpcProps:ec2.VpcProps = {
      maxAzs: 1,
      natGateways: 1
    }

    this.vpc = new ec2.Vpc(this, 'VPC', vpcProps);

    const fileSystem = new efs.FileSystem(this, 'Efs', { vpc: this.vpc });

    this.accessPoint = fileSystem.addAccessPoint('AccessPoint', {
      path: this.filesPath,
      createAcl: {
        ownerUid: '1001',
        ownerGid: '1001',
        permissions: '750',
      },
      posixUser: {
        uid: '1001',
        gid: '1001',
      },
    });
  }
}
