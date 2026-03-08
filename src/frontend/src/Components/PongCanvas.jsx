import { useRef, useEffect, useState } from 'react'
import './PongCanvas.css'

export default function PongCanvas()
{
    const canvasRef = useRef(null);
    const [count, setCount] = useState(0);


    useEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        const interval = setInterval(() => {
            setCount(prevCount => prevCount + 1);
            context.fillStyle = '#000000';
            context.fillRect(0, 0, context.canvas.width, context.canvas.height);
            setCount(++count)
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    return(

        <div className='canvas-container'>
            <h3>{count}</h3>
            <canvas ref={canvasRef} width={1000} height={600}></canvas>
        </div>
    );
}
