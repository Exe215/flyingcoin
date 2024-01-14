import { VersionedTransactionResponse, Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { Metaplex } from '@metaplex-foundation/js';
import WebSocket from 'ws';
import { PoolInfoLayout, SqrtPriceMath } from '@raydium-io/raydium-sdk';
import axios from 'axios';


interface ExtendedWebSocket extends WebSocket {
    isAlive: boolean;
}

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

interface Pair {
    chainId: string;
    dexId: string;
    url: string;
    pairAddress: string;
    baseToken: {
      address: string;
      name: string;
      symbol: string;
    };
    quoteToken: {
      symbol: string;
    };
    priceNative: string;
    priceUsd?: string;
    txns: {
      m5: {
        buys: number;
        sells: number;
      };
      h1: {
        buys: number;
        sells: number;
      };
      h6: {
        buys: number;
        sells: number;
      };
      h24: {
        buys: number;
        sells: number;
      };
    };
    volume: {
      m5: number;
      h1: number;
      h6: number;
      h24: number;
    };
    priceChange: {
      m5: number;
      h1: number;
      h6: number;
      h24: number;
    };
    liquidity?: {
      usd?: number;
      base: number;
      quote: number;
    };
    fdv?: number;
    pairCreatedAt?: number;
  }

const cacheSize = 50;
const cache: any[] = [];

function addToCache(data: any) {
    if (cache.length >= cacheSize) {
        cache.shift();
    }
    cache.push(data);
}

function getCache() {
    return cache;
}

const getConnection = () => {
    return new Connection(clusterApiUrl('mainnet-beta'));
};

async function getClmmPoolInfo(id: PublicKey, connection: Connection, maxRetries = 3) {
    console.log(id.toString());

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const accountInfo = await connection.getAccountInfo(id);

            if (accountInfo === null) {
                throw new Error('Account info not available');
            }

            const poolData = PoolInfoLayout.decode(accountInfo.data);

            console.log('current Liquidity -> ', SqrtPriceMath.sqrtPriceX64ToPrice(poolData.liquidity, poolData.mintDecimalsA, poolData.mintDecimalsB));
            console.log(poolData);
            return; // Exit the function after successful fetch
        } catch (error) {
            console.log(`Attempt ${attempt + 1} failed:`, error);
            if (attempt < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, 10000));
            } else {
                throw error;
            }
        }
    }
}

async function getBirdeyeInfo(Contract: string) {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${Contract}`;
    console.log(url);

    let attempts = 0;
    const maxAttempts = 5;
    const retryDelay = 2000; // Delay in milliseconds (2000 ms = 2 seconds)

    while (attempts < maxAttempts) {
        try {
            const response = await axios.get(url);
            if (response.data.pairs) {
                return response.data; // Return data if successful
            }
        } catch (error) {
            console.error(`Attempt ${attempts + 1}: Error fetching data from DexScreener API`, error);
        }

        attempts++;
        if (attempts < maxAttempts) {
            console.log(`Retrying... Attempt ${attempts + 1}`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }

    console.error("Failed to fetch data after maximum attempts");
    return null; // Return null after all attempts fail
}

function extractAccountData(transactionData: VersionedTransactionResponse, accountIndex: number) {
    if (!transactionData.meta || !transactionData.meta.postTokenBalances) {
        console.error("Post token balances data is not available");
        return null;
    }

    const accountData = transactionData.meta.postTokenBalances.find(account => account.accountIndex === accountIndex);
    if (!accountData) {
        console.error(`No data found for account index ${accountIndex}`);
        return null;
    }

    const LPTokenID = transactionData.meta.postTokenBalances.find(account => account.accountIndex === 10);
    const LPSize = transactionData.meta.postTokenBalances.find(account => account.accountIndex === 6);
    const PoolID = transactionData.transaction.message.staticAccountKeys[2];

    return {
        mint: accountData.mint,
        owner: accountData.owner,
        tokenAmount: accountData.uiTokenAmount,
        LPTokenID: LPTokenID?.mint,
        PoolID: PoolID,
        LPSize: LPSize?.uiTokenAmount.uiAmountString
    };
}

function containsOnlySpecificInstructions(logs: any[], instructions: any[]) {
    return logs.every((log: string) => instructions.includes(log.trim())) &&
           instructions.every((instruction: any) => logs.some((log: string | any[]) => log.includes(instruction)));
}

async function fetchTransactionWithRetry(connection: Connection, signature: string, maxRetries: number = 3) {
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
            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    }
    throw new Error(`Transaction details for ${signature} could not be fetched after ${maxRetries} retries`);
}

const wss = new WebSocket.Server({ port: 8080, maxPayload: 10 * 1024 * 1024 });
console.log("WebSocket server started on port 8080");

wss.on('connection', ws => {
    console.log('A client connected');

    cache.forEach(cachedItem => {
        ws.send(cachedItem);
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });

    ws.on('error', error => {
        console.error('WebSocket error:', error);
    });
});

// Implement WebSocket keep-alive mechanism
function heartbeat(this: any) {
    this.isAlive = true;
}

wss.on('connection', (ws) => {
    const extWs = ws as ExtendedWebSocket;
    extWs.isAlive = true;

    extWs.on('pong', () => {
        extWs.isAlive = true;
    });
});

const interval = setInterval(function ping() {
    wss.clients.forEach((ws) => {
        const extWs = ws as ExtendedWebSocket;

        if (extWs.isAlive === false) return ws.terminate();

        extWs.isAlive = false;
        ws.ping();
    });
}, 30000);

wss.on('close', function close() {
    clearInterval(interval);
});

function extractSocialsInDescription(desc: string): { x: string | null, tg: string | null, website: string | null } {
    const twitterLinkRegex = /https?:\/\/(x|twitter)\.com\/[^\s]+/i;
    const telegramLinkRegex = /https?:\/\/t\.me\/[^\s]+/i;
    const websiteLinkRegex = /https?:\/\/(?![^\s]*(x|twitter|t\.me))[^\s]+/gi;

    const twitterLinkMatch = desc.match(twitterLinkRegex);
    const twitterLink = twitterLinkMatch ? twitterLinkMatch[0] : null;

    const telegramLinkMatch = desc.match(telegramLinkRegex);
    const telegramLink = telegramLinkMatch ? telegramLinkMatch[0] : null;

    let websiteLinkMatch = desc.match(websiteLinkRegex);
    let websiteLink = websiteLinkMatch ? websiteLinkMatch[0] : null;

    return {
        x: twitterLink,
        tg: telegramLink,
        website: websiteLink
    };
}

async function main() {
    const connection = getConnection();
    const programId = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');
    const programIdBurn = new PublicKey('5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1');
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
                console.log(accountData.mint)
                //const birdeye = await getBirdeyeInfo(accountData.mint);
                const socials = extractSocialsInDescription(nft.json?.description || '');
                //const PoolData = getClmmPoolInfo(accountData.PoolID, connection);
                const data = nft.json;
                const enrichedData = {
                    ...data,
                    ...socials,
                    CA: accountData.mint,
                    LPToken: accountData.LPTokenID,
                    PoolID: accountData.PoolID,
                    LPSize: accountData.LPSize
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

    console.log("Listening for 'create pool' and 'burn' events...");
}

main().catch(err => {
    console.error('Error in main function:', err);
});

// Global error handlers
process.on('uncaughtException', error => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled Rejection:', error);
});

