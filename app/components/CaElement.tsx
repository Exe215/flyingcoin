import React from 'react';

type CaElementProps = {
    ca: string;
};

const CaElement: React.FC<CaElementProps> = ({ ca }) => {
    const copyTextToClipboard = async (text: string) => {
        if ('clipboard' in navigator) {
            return await navigator.clipboard.writeText(text);
        } else {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
    };

    const handleClick = () => {
        copyTextToClipboard(ca)
            .then(() => {
                // Handle successful copying here, e.g., show a notification
                console.log('Text copied to clipboard');
            })
            .catch(err => {
                // Handle errors here
                console.error('Failed to copy text: ', err);
            });
    };

    return (
        <div onClick={handleClick} style={{ cursor: 'pointer', fontSize: '10px' }}>
            {ca}
        </div>
    );
};

export default CaElement;
