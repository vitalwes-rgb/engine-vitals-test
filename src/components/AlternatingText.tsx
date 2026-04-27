import React from 'react';

interface AlternatingTextProps {
  text: string;
  primaryColorClass?: string;
  secondaryColorClass?: string;
}

export default function AlternatingText({ 
  text, 
  primaryColorClass = "text-white",
  secondaryColorClass = "text-primary"
}: AlternatingTextProps) {
  const words = text.split(' ');
  
  return (
    <>
      {words.map((word, index) => (
        <React.Fragment key={index}>
          <span className={index % 2 === 0 ? primaryColorClass : secondaryColorClass}>
            {word}
          </span>
          {index < words.length - 1 ? ' ' : ''}
        </React.Fragment>
      ))}
    </>
  );
}
