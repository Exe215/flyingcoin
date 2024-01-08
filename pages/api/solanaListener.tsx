import type { NextApiRequest, NextApiResponse } from 'next';
import { Connection, PublicKey, VersionedTransactionResponse, clusterApiUrl } from '@solana/web3.js';
import { Metaplex } from '@metaplex-foundation/js';

interface TransactionData {
    meta?: {
        postTokenBalances: Array<{
            accountIndex: number;
            mint: string;
            owner: string;
            programId: string;
            uiTokenAmount: any; // Define a more specific type if known
        }>;
    };
}

function extractAccountData(transactionData: VersionedTransactionResponse, accountIndex: number) {
    // Check if meta is available and has postTokenBalances
    if (!transactionData.meta || !transactionData.meta.postTokenBalances) {
        console.error("Post token balances data is not available");
        return null;
    }

    // Find the account data for the specified index
    const accountData = transactionData.meta.postTokenBalances.find((account: { accountIndex: number; }) => account.accountIndex === accountIndex);
    
    if (!accountData) {
        console.error(`No data found for account index ${accountIndex}`);
        return null;
    }

    // Returning the relevant data for the account
    return {
        mint: accountData.mint,
        owner: accountData.owner,
        tokenAmount: accountData.uiTokenAmount
    };
}


async function fetchTransactionWithRetry(connection: Connection, signature: string, maxRetries: number = 5) {
    let delayMs = 2000;

    for (let i = 0; i < maxRetries; i++) {
        try {
            await connection.confirmTransaction(signature, 'confirmed');
            const transaction = await connection.getTransaction(signature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0
            });

            if (transaction) {
                return transaction;
            }
        } catch (error) {
            console.error(`Error on attempt ${i + 1}:`, error);
        }

        await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    throw new Error(`Transaction details for ${signature} could not be fetched after ${maxRetries} retries`);
}


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        // Initialize Solana Connection
        const connection = new Connection(clusterApiUrl('mainnet-beta'));
        const programId = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');
        const metaplex = Metaplex.make(connection);
        
        connection.onLogs(programId, async (logs, context) => {
            const isCreatePoolEvent = logs.logs.some(log => log.includes('Program log: Instruction: InitializeMint'));
    
            if (isCreatePoolEvent) {
                try {
                    console.log("Found InitializeMint Event", logs.signature);
                    const transactionDetails = await fetchTransactionWithRetry(connection, logs.signature);
                    if (!transactionDetails) throw new Error("Transaction details not found");
    
                    const accountIndex = 9;
                    const accountData = extractAccountData(transactionDetails, accountIndex);
                    if (!accountData) throw new Error("Account data not found");
                    const nft = await metaplex.nfts().findByMint({ mintAddress: new PublicKey(accountData.mint) });
                    console.log(nft.json);
                } catch (error) {
                    console.error('Error fetching transaction details:', error);
                }
            }
        }, "confirmed");
    
        console.log("Listening for 'create pool' events...");

        res.status(200).json({ message: 'Listener setup complete' });
    } else {
        // Handle any other HTTP method
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
