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
        const socket = new WebSocket('ws://flyingcoin.xyz:8080');

        socket.onmessage = (event) => {
            const newData = JSON.parse(event.data);
            setData(prevData => [newData, ...prevData]);
        };

        socket.onclose = () => {
            console.log('WebSocket Disconnected');
        };

        return () => {
            socket.close();
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
