import React from 'react';
import './Grid.css';

const Grid = ({ size, robotPos, visitedCells }) => {
  const cells = Array.from({ length: size * size }, (_, i) => i);

  return (
    <div 
      className="grid-container" 
      style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
    >
      {cells.map((cell) => {
        const x = cell % size;
        const y = Math.floor(cell / size);
        
        const isRobot = robotPos.x === x && robotPos.y === y;
        // Verificamos si esta coordenada existe en nuestro registro de siembra
        const isPlanted = visitedCells.has(`${x},${y}`);

        return (
          <div 
            key={cell} 
            className={`cell ${isRobot ? 'robot' : ''} ${isPlanted ? 'planted' : ''}`}
          >
            {isRobot && <div className="robot-icon" />}
            {isPlanted && <div className="planted-icon" />}
          </div>
        );
      })}
    </div>
  );
};

export default Grid;