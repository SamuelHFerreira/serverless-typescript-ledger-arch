import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as MastersOfMultiverse from '../lib/masters-of-multiverse-stack';

test('Stack Tests', () => {
  const app = new cdk.App();

  const stack = new MastersOfMultiverse.MastersOfMultiverseStack(app, 'MyTestStack');

  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::Lambda::Function', {
    Handler: 'operations/postUser.handler',
  });

  template.hasResourceProperties('AWS::Lambda::Function', {
    Handler: 'operations/getUser.handler',
  });
});
