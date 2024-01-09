'use client';
import Image from 'next/image';
import React, { useState, useEffect } from 'react';
import FlyingCoinCards from './components/FlyingCoinCards'; // Adjust the import path as necessary

interface NFTData {
    name: string;
    symbol: string;
    image: string;
    description: string;
    CA: string;
}

function App() {
    const [data, setData] = useState<NFTData[]>([]);

    useEffect(() => {
        let socket: WebSocket;
        let reconnectInterval = 5000; // Reconnect every 5 seconds

        function connectWebSocket() {
            socket = new WebSocket('wss://flyingcoin.xyz/ws');

            socket.onmessage = (event) => {
                const newData = JSON.parse(event.data);
                console.log(event)
                setData(prevData => [newData, ...prevData]);
            };

            socket.onopen = () => {
                console.log('WebSocket Connected');
            };

            socket.onclose = (e) => {
                console.log('WebSocket Disconnected', e.reason);
                setTimeout(connectWebSocket, reconnectInterval);
            };

            socket.onerror = (error) => {
                console.error('WebSocket Error', error);
                socket.close(); // Ensure the close handler is triggered
            };
        }

        connectWebSocket();

        return () => {
            if (socket) {
                socket.close();
            }
        };
    }, []);

    return (
        <div>
            <h1>Flying Coin - BETA</h1>
            <FlyingCoinCards data={data} />
            
        </div>
    );
}

export default App;
