import React from 'react';

interface SkeletonProps {
  width?: string;
  height?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ width = '100%', height = '16px', className = '', style }: SkeletonProps) {
  return (
    <span 
      className={`skeleton ${className}`}
      style={{
        width,
        height,
        ...style
      }}
    />
  );
}
