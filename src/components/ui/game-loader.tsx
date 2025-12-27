import * as React from "react";

export function GameLoader() {
  const letters = "LOADING".split("");
  
  return (
    <div className="game-loader-wrapper">
      {letters.map((letter, index) => (
        <span 
          key={index} 
          className="game-loader-letter"
          style={{ animationDelay: `${0.1 + index * 0.105}s` }}
        >
          {letter}
        </span>
      ))}
      <div className="game-loader-effect" />
    </div>
  );
}

