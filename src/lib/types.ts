import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';

export interface ProgramDCAAccount {
    publicKey: PublicKey;
    account: {
        user: PublicKey;
        inputMint: PublicKey;
        outputMint: PublicKey;
        idx: BN;
        nextCycleAt: BN;
        inDeposited: BN;
        inWithdrawn: BN;
        outWithdrawn: BN;
        inUsed: BN;
        inAmountPerCycle: BN;
        cycleFrequency: BN;
        bump: number;
        minOutAmount?: BN;
        maxOutAmount?: BN;
    };
}

export type DcaOrder = ProgramDCAAccount; 