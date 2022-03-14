import { Contract, Context } from 'fabric-contract-api';

const balancePrefix = 'balance';
const nftPrefix = 'nft';
const approvalPrefix = 'approval';

const nameKey = 'name';
const symbolKey = 'symbol';

export { Contract, Context } from 'fabric-contract-api';

export type NFT = {
  owner: string;
  readonly tokenId: string;
  readonly tokenURI: string;
  approved?: string;
};

export class TokenMMUContract extends Contract {
  constructor(name?: string) {
    super(name);
  }

  async BalanceOf(ctx: Context, owner: string): Promise<number> {
    const iterator = await ctx.stub.getStateByPartialCompositeKey(balancePrefix, [owner]);

    // Count the number of returned composite keys
    let balance = 0;
    let result = await iterator.next();
    while (!result.done) {
      balance++;
      result = await iterator.next();
    }
    return balance;
  }

  async OwnerOf(ctx: Context, tokenId: string): Promise<string> {
    const nft = await this._readNFT(ctx, tokenId);
    const owner = nft.owner;
    if (!owner) {
      throw new Error('No owner is assigned to this token');
    }

    return owner;
  }

  async TransferFrom(ctx: Context, from: string, to: string, tokenId: string): Promise<boolean> {
    const sender = ctx.clientIdentity.getID();

    const nft = await this._readNFT(ctx, tokenId);

    // Check if the sender is the current owner, an authorized operator,
    // or the approved client for this non-fungible token.
    const owner = nft.owner;
    const tokenApproval = nft.approved;
    const operatorApproval = await this.IsApprovedForAll(ctx, owner, sender);
    if (owner !== sender && tokenApproval !== sender && !operatorApproval) {
      throw new Error('The sender is not allowed to transfer the non-fungible token');
    }

    // Check if `from` is the current owner
    if (owner !== from) {
      throw new Error('The from is not the current owner.');
    }

    // Clear the approved client for this non-fungible token
    nft.approved = '';

    // Overwrite a non-fungible token to assign a new owner.
    nft.owner = to;
    const nftKey = ctx.stub.createCompositeKey(nftPrefix, [tokenId]);
    await ctx.stub.putState(nftKey, Buffer.from(JSON.stringify(nft)));

    const balanceKeyFrom = ctx.stub.createCompositeKey(balancePrefix, [from, tokenId]);
    await ctx.stub.deleteState(balanceKeyFrom);

    const balanceKeyTo = ctx.stub.createCompositeKey(balancePrefix, [to, tokenId]);
    await ctx.stub.putState(balanceKeyTo, Buffer.from('\u0000'));

    const tokenIdInt = parseInt(tokenId);
    const transferEvent = { from: from, to: to, tokenId: tokenIdInt };
    ctx.stub.setEvent('Transfer', Buffer.from(JSON.stringify(transferEvent)));

    return true;
  }

  async Approve(ctx: Context, approved: string, tokenId: string): Promise<boolean> {
    const sender = ctx.clientIdentity.getID();

    const nft = await this._readNFT(ctx, tokenId);

    const owner = nft.owner;
    const operatorApproval = await this.IsApprovedForAll(ctx, owner, sender);
    if (owner !== sender && !operatorApproval) {
      throw new Error('The sender is not the current owner nor an authorized operator');
    }

    nft.approved = approved;
    const nftKey = ctx.stub.createCompositeKey(nftPrefix, [tokenId]);
    await ctx.stub.putState(nftKey, Buffer.from(JSON.stringify(nft)));

    const tokenIdInt = parseInt(tokenId);
    const approvalEvent = {
      owner: owner,
      approved: approved,
      tokenId: tokenIdInt,
    };
    ctx.stub.setEvent('Approval', Buffer.from(JSON.stringify(approvalEvent)));

    return true;
  }

  async SetApprovalForAll(ctx: Context, operator: string, approved: string): Promise<boolean> {
    const sender = ctx.clientIdentity.getID();

    const approval = { owner: sender, operator: operator, approved: approved };
    const approvalKey = ctx.stub.createCompositeKey(approvalPrefix, [sender, operator]);
    await ctx.stub.putState(approvalKey, Buffer.from(JSON.stringify(approval)));

    const approvalForAllEvent = {
      owner: sender,
      operator: operator,
      approved: approved,
    };
    ctx.stub.setEvent('ApprovalForAll', Buffer.from(JSON.stringify(approvalForAllEvent)));

    return true;
  }

  async GetApproved(ctx: Context, tokenId: string): Promise<string> {
    const nft = await this._readNFT(ctx, tokenId);
    return nft.approved!;
  }

  async IsApprovedForAll(ctx: Context, owner: string, operator: string): Promise<boolean> {
    const approvalKey = ctx.stub.createCompositeKey(approvalPrefix, [owner, operator]);
    const approvalBytes = await ctx.stub.getState(approvalKey);
    let approved;
    if (approvalBytes && approvalBytes.length > 0) {
      const approval = JSON.parse(approvalBytes.toString());
      approved = approval.approved;
    } else {
      approved = false;
    }

    return approved;
  }

  async Name(ctx: Context): Promise<string> {
    const nameAsBytes = await ctx.stub.getState(nameKey);
    return nameAsBytes.toString();
  }

  async Symbol(ctx: Context): Promise<string> {
    const symbolAsBytes = await ctx.stub.getState(symbolKey);
    return symbolAsBytes.toString();
  }

  async TokenURI(ctx: Context, tokenId: string): Promise<string> {
    const nft = await this._readNFT(ctx, tokenId);
    return nft.tokenURI;
  }

  async TotalSupply(ctx: Context): Promise<number> {
    const iterator = await ctx.stub.getStateByPartialCompositeKey(nftPrefix, []);

    let totalSupply = 0;
    let result = await iterator.next();
    while (!result.done) {
      totalSupply++;
      result = await iterator.next();
    }
    return totalSupply;
  }

  async SetOption(ctx: Context, name: string, symbol: string): Promise<boolean> {
    const clientMSPID = ctx.clientIdentity.getMSPID();
    if (clientMSPID !== 'Org1MSP') {
      throw new Error('client is not authorized to set the name and symbol of the token');
    }

    await ctx.stub.putState(nameKey, Buffer.from(name));
    await ctx.stub.putState(symbolKey, Buffer.from(symbol));
    return true;
  }

  async MintWithTokenURI(ctx: Context, tokenId: string, tokenURI: string): Promise<NFT> {
    const clientMSPID = ctx.clientIdentity.getMSPID();
    if (clientMSPID !== 'Org1MSP') {
      throw new Error('client is not authorized to mint new tokens');
    }

    // Get ID of submitting client identity
    const minter = ctx.clientIdentity.getID();

    // Check if the token to be minted does not exist
    const exists = await this._nftExists(ctx, tokenId);
    if (exists) {
      throw new Error(`The token ${tokenId} is already minted.`);
    }

    // Add a non-fungible token
    const tokenIdInt = parseInt(tokenId);
    if (isNaN(tokenIdInt)) {
      throw new Error(`The tokenId ${tokenId} is invalid. tokenId must be an integer`);
    }
    const nft: NFT = {
      tokenId: tokenId,
      owner: minter,
      tokenURI: tokenURI,
    };
    const nftKey = ctx.stub.createCompositeKey(nftPrefix, [tokenId]);
    await ctx.stub.putState(nftKey, Buffer.from(JSON.stringify(nft)));

    const balanceKey = ctx.stub.createCompositeKey(balancePrefix, [minter, tokenId]);
    await ctx.stub.putState(balanceKey, Buffer.from('\u0000'));

    // Emit the Transfer event
    const transferEvent = { from: '0x0', to: minter, tokenId: tokenIdInt };
    ctx.stub.setEvent('Transfer', Buffer.from(JSON.stringify(transferEvent)));

    return nft;
  }

  async Burn(ctx: Context, tokenId: string): Promise<boolean> {
    const owner = ctx.clientIdentity.getID();

    // Check if a caller is the owner of the non-fungible token
    const nft = await this._readNFT(ctx, tokenId);
    if (nft.owner !== owner) {
      throw new Error(`Non-fungible token ${tokenId} is not owned by ${owner}`);
    }

    // Delete the token
    const nftKey = ctx.stub.createCompositeKey(nftPrefix, [tokenId]);
    await ctx.stub.deleteState(nftKey);

    // Remove a composite key from the balance of the owner
    const balanceKey = ctx.stub.createCompositeKey(balancePrefix, [owner, tokenId]);
    await ctx.stub.deleteState(balanceKey);

    // Emit the Transfer event
    const tokenIdInt = parseInt(tokenId);
    const transferEvent = { from: owner, to: '0x0', tokenId: tokenIdInt };
    ctx.stub.setEvent('Transfer', Buffer.from(JSON.stringify(transferEvent)));

    return true;
  }

  async _readNFT(ctx: Context, tokenId: string): Promise<NFT> {
    const nftKey = ctx.stub.createCompositeKey(nftPrefix, [tokenId]);
    const nftBytes = await ctx.stub.getState(nftKey);
    if (!nftBytes || nftBytes.length === 0) {
      throw new Error(`The tokenId ${tokenId} is invalid. It does not exist`);
    }
    const nft = JSON.parse(nftBytes.toString());
    return nft;
  }

  async _nftExists(ctx: Context, tokenId: string): Promise<boolean> {
    const nftKey = ctx.stub.createCompositeKey(nftPrefix, [tokenId]);
    const nftBytes = await ctx.stub.getState(nftKey);
    return nftBytes && nftBytes.length > 0;
  }

  async ClientAccountBalance(ctx: Context): Promise<number> {
    const clientAccountID = ctx.clientIdentity.getID();
    return this.BalanceOf(ctx, clientAccountID);
  }

  async ClientAccountID(ctx: Context): Promise<string> {
    // Get ID of submitting client identity
    const clientAccountID = ctx.clientIdentity.getID();
    return clientAccountID;
  }
}

module.exports = TokenMMUContract;
