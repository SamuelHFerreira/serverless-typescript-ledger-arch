// CA Configuration Properties
export interface CCP {
    name: string
    version: string
    client: Client
    organizations: Organizations
    peers: Peers
    certificateAuthorities: CertificateAuthorities
  }
  
  export interface Client {
    organization: string
    connection: Connection
  }
  
  export interface Connection {
    timeout: Timeout
  }
  
  export interface Timeout {
    peer: Peer
  }
  
  export interface Peer {
    endorser: string
  }
  
  export interface Organizations {
    "Org${ORG}": OrgOrg
  }
  
  export interface OrgOrg {
    mspid: string
    peers: string[]
    certificateAuthorities: string[]
  }
  
  export interface Peers {
    "peer0.org${ORG}.example.com": Peer0OrgOrgExampleCom
  }
  
  export interface Peer0OrgOrgExampleCom {
    url: string
    tlsCACerts: TlsCacerts
    grpcOptions: GrpcOptions
  }
  
  export interface TlsCacerts {
    pem: string
  }
  
  export interface GrpcOptions {
    "ssl-target-name-override": string
    hostnameOverride: string
  }
  
  export interface CertificateAuthorities {
    [index: string]: CAOrg;
  }
  
  export interface CAOrg {
    url: string
    caName: string
    tlsCACerts: TlsCacerts2
    httpOptions: HttpOptions
  }
  
  export interface TlsCacerts2 {
    pem: string[]
  }
  
  export interface HttpOptions {
    verify: boolean
  }
  