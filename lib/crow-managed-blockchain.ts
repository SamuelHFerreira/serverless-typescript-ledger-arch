
import * as mbc from 'aws-cdk-lib/aws-managedblockchain';
import { CfnMemberProps}  from 'aws-cdk-lib/aws-managedblockchain';
import { Construct } from 'constructs';

export interface ChainProps {
    username: string,
    password: string,
    networkMemberName?: string
}

export class CrowManagedBlockchain extends Construct {

    constructor(scope: Construct, id: string, props: ChainProps) {
        super(scope, id);
        const memberConfiguration: CfnMemberProps = {
            memberConfiguration: this.getMemberConfig(props),
            networkConfiguration: this.getNetworkConfig()
        }
        const bc = new mbc.CfnMember(this, 'Crow Member', memberConfiguration);
    }   

    private getNetworkConfig() {
        const fabricNetworkConfig: mbc.CfnMember.NetworkFabricConfigurationProperty = {
            edition: 'STARTER'
        };

        const netFrameworkConfig: mbc.CfnMember.NetworkFrameworkConfigurationProperty = {
            networkFabricConfiguration: fabricNetworkConfig
        };

        const approvalThresholdPolicy: mbc.CfnMember.ApprovalThresholdPolicyProperty = {
            proposalDurationInHours: 24,
            thresholdPercentage: 50,
            thresholdComparator: 'GREATER_THAN'
        };

        const votingPolicyConfig: mbc.CfnMember.VotingPolicyProperty = {
            approvalThresholdPolicy: approvalThresholdPolicy
        };

        const networkConfig: mbc.CfnMember.NetworkConfigurationProperty = {
            name: 'CrowBlockChain',
            description: 'Generated Newtork.',
            framework: 'HYPERLEDGER_FABRIC',
            frameworkVersion: '2.2',
            networkFrameworkConfiguration: netFrameworkConfig,
            votingPolicy: votingPolicyConfig
        };

        return networkConfig;
    }

    private getMemberConfig(props: ChainProps) {
        const fabricConfig: mbc.CfnMember.MemberFabricConfigurationProperty = {
            adminPassword: props.password,
            adminUsername: props.username,
        };

        const memberFrameworkConfig: mbc.CfnMember.MemberFrameworkConfigurationProperty = {
            memberFabricConfiguration: fabricConfig,
        };

        const memberConfigProps: mbc.CfnMember.MemberConfigurationProperty = {
            name: props.networkMemberName ?? 'CrowMember',
            description: 'First network member.',
            memberFrameworkConfiguration: memberFrameworkConfig
        };
        return memberConfigProps;
    }
}