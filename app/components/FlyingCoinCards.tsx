import React, { useEffect, useState } from 'react';

const FlyingCoinCards = ({ data }) => {
    const [animatedItems, setAnimatedItems] = useState(new Set());

    useEffect(() => {
        // Filter out items that are already in the animatedItems set
        const newItems = data.filter(item => !animatedItems.has(item.CA));

        if (newItems.length > 0) {
            // Add new items to the animatedItems set
            const updatedAnimatedItems = new Set(animatedItems);
            newItems.forEach(item => updatedAnimatedItems.add(item.CA));
            setAnimatedItems(updatedAnimatedItems);

            // Set a timeout to clear the animatedItems set after the animation duration
            const timer = setTimeout(() => {
                setAnimatedItems(current => {
                    const newSet = new Set(current);
                    newItems.forEach(item => newSet.delete(item.CA));
                    return newSet;
                });
            }, 1000); // Animation duration should match CSS

            return () => clearTimeout(timer);
        }
    }, [data]);

    return (
        <div>
            <h3>New minted Raydium Pools</h3>
            <table className="container">
                <thead>
                </thead>
                <tbody>
                    {data.map((item, index) => (
                        <tr key={index}>
                            <td>
                                <div className={`card ${animatedItems.has(item.CA) ? 'fade-in' : ''}`}>
                                    <img src={item.image} alt="image" className="card_image" />
                                    <div className="card_body">
                                        <h2 className="card_name">{item.name}</h2>
                                        <p className="card_occupation">{item.description}</p>
                                        <a href="#" className="card_button"><i className='bx bx-envelope'></i>{item.CA}</a>
                                    </div>
                                    
                                    <div className="card_footer">
                                        {/* Other card content */}
                                        <a href={"https://raydium.io/swap/?inputCurrency=sol&outputCurrency="+ item.CA} className="card_button" target='_blank'><img src="https://img.raydium.io/icon/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R.png" width="30px"></img></a>
                                        <a href={"https://birdeye.so/token/"+ item.CA} className="card_button" target='_blank'><img src="https://birdeye.so/favicon.ico" width="30px"></img></a>
                                        <a href={"https://solscan.io/token/"+ item.CA} className="card_button"target='_blank'><img src="https://solscan.io/favicon.ico" width="30px"></img></a>
                                    </div>
                                </div>
                            </td>    
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default FlyingCoinCards;