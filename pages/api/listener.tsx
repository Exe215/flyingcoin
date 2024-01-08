import { VersionedTransactionResponse, Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { Metaplex} from '@metaplex-foundation/js';
import { Metadata } from '@metaplex-foundation/mpl-token-metadata';
import WebSocket from 'ws';




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


const cacheSize = 50;
const cache: any[] = [];

function addToCache(data: any) {
    if (cache.length >= cacheSize){
        cache.shift();
    }
    cache.push(data);
}

function getCache(){
    return cache;
}

function extractAccountData(transactionData: VersionedTransactionResponse, accountIndex: number) {
    // Check if meta is available and has postTokenBalances
    if (!transactionData.meta || !transactionData.meta.postTokenBalances) {
        console.error("Post token balances data is not available");
        return null;
    }

    // Find the account data for the specified index
    const accountData = transactionData.meta.postTokenBalances.find(account => account.accountIndex === accountIndex);
    
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

function containsOnlySpecificInstructions(logs: any[], instructions: any[]) {
    // Check if all logs are in the list of specific instructions
    return logs.every((log: string) => instructions.includes(log.trim())) && 
           // And all specific instructions are in the logs
           instructions.every((instruction: any) => logs.some((log: string | any[]) => log.includes(instruction)));
}


async function fetchTransactionWithRetry(connection: Connection, signature: string, maxRetries: number = 1) {
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

const wss = new WebSocket.Server({ port: 8080 , maxPayload: 10 * 1024 * 1024 });
console.log("WebSocket server started on port 8080");

wss.on('connection', ws => {
    console.log('A client connected');

    cache.forEach(cachedItem => {
        ws.send(cachedItem);
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});



async function main() {
    const connection = new Connection(clusterApiUrl('mainnet-beta'));
    const programId = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');
    const programIdBurn = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
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
                const data = nft.json;
                const enrichedData = {
                    ...data,
                    CA: accountData.mint,
                };
                if(data){
                const datasend = JSON.stringify(enrichedData);
                addToCache(datasend);
                console.log(enrichedData);

                // Broadcasting the data to all connected clients
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(datasend);
                    }
                });
            }
            } catch (error) {
                console.error('Error fetching transaction details:', error);
            }
        }
    }, "confirmed");

    
    connection.onLogs(programIdBurn, async (logs, context) => {
        const instructionsOfInterest = ["Program log: Instruction: Burn", "Program log: Instruction: CloseAccount"];
        const isBurnEvent = containsOnlySpecificInstructions(logs.logs, instructionsOfInterest);

        if (isBurnEvent) {
            try {
                console.log("Found Burn Event", logs.signature);
                console.log(logs);
                const transactionDetails = await fetchTransactionWithRetry(connection, logs.signature);
                if (!transactionDetails) throw new Error("Transaction details not found");
                console.log(transactionDetails);

                const accountIndex = 9;
                const accountData = extractAccountData(transactionDetails, accountIndex);
                if (!accountData) throw new Error("Account data not found");

                const nft = await metaplex.nfts().findByMint({ mintAddress: new PublicKey(accountData.mint) });
                const data = nft.json
                const enrichedData = {
                    ...data,
                    CA: accountData.mint,
                };
                const datasend = JSON.stringify(enrichedData);
                addToCache(datasend);
                console.log(enrichedData);

                // Broadcasting the data to all connected clients
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(datasend);
                    }
                });
            } catch (error) {
                console.error('Error fetching transaction details:', error);
            }
        }
    }, "confirmed");


    console.log("Listening for 'create pool' events...");
}

main().catch(err => {
    console.error('Error:', err);
});
