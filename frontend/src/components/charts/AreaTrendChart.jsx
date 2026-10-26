import { useState } from 'react';

const AreaTrendChart = ({ data = [], height = 240, color = '#6366f1', labelKey = 'day_name', valueKey = 'present' }) => {
    const [hoveredIdx, setHoveredIdx] = useState(null);

    if (!data || data.length === 0) {
        return (
            <div className="flex h-56 items-center justify-center text-slate-400 text-sm">
                No trend data available
            </div>
        );
    }

    const width = 500;
    const paddingX = 40;
    const paddingY = 30;
    const graphWidth = width - paddingX * 2;
    const graphHeight = height - paddingY * 2;

    const values = data.map(d => Number(d[valueKey]) || 0);
    const maxVal = Math.max(...values, 5); // At least scale of 5
    const minVal = 0;

    const points = data.map((d, i) => {
        const x = paddingX + (i / Math.max(data.length - 1, 1)) * graphWidth;
        const val = Number(d[valueKey]) || 0;
        const y = paddingY + graphHeight - ((val - minVal) / (maxVal - minVal)) * graphHeight;
        return { x, y, raw: d, val };
    });

    const linePath = points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '');
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${paddingY + graphHeight} L ${points[0].x} ${paddingY + graphHeight} Z`;

    const gridLines = [0, 0.25, 0.5, 0.75, 1];

    return (
        <div className="relative w-full overflow-hidden select-none">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
                <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.35" />
                        <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                    </linearGradient>
                </defs>

                {/* Horizontal Grid lines */}
                {gridLines.map((ratio, idx) => {
                    const y = paddingY + graphHeight * (1 - ratio);
                    const val = Math.round(minVal + (maxVal - minVal) * ratio);
                    return (
                        <g key={idx}>
                            <line
                                x1={paddingX}
                                y1={y}
                                x2={width - paddingX}
                                y2={y}
                                stroke="#f1f5f9"
                                strokeDasharray="3 3"
                            />
                            <text
                                x={paddingX - 8}
                                y={y + 3}
                                textAnchor="end"
                                fontSize="10"
                                fill="#94a3b8"
                                className="font-mono"
                            >
                                {val}
                            </text>
                        </g>
                    );
                })}

                {/* Area and Line */}
                <path d={areaPath} fill="url(#areaGradient)" />
                <path
                    d={linePath}
                    fill="none"
                    stroke={color}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* Data Points and Interactivity */}
                {points.map((p, idx) => (
                    <g key={idx} onMouseEnter={() => setHoveredIdx(idx)} onMouseLeave={() => setHoveredIdx(null)}>
                        {/* Transparent larger hit-target */}
                        <circle cx={p.x} cy={p.y} r="14" fill="transparent" className="cursor-pointer" />
                        
                        <circle
                            cx={p.x}
                            cy={p.y}
                            r={hoveredIdx === idx ? 5.5 : 3.5}
                            fill="#ffffff"
                            stroke={color}
                            strokeWidth="2.5"
                            className="transition-all duration-150"
                        />

                        {/* X-axis Label */}
                        <text
                            x={p.x}
                            y={height - 8}
                            textAnchor="middle"
                            fontSize="11"
                            fill={hoveredIdx === idx ? '#1e293b' : '#64748b'}
                            fontWeight={hoveredIdx === idx ? '600' : '400'}
                        >
                            {p.raw[labelKey]}
                        </text>
                    </g>
                ))}
            </svg>

            {/* Floating Tooltip */}
            {hoveredIdx !== null && (
                <div
                    className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-full bg-slate-900 text-white text-xs px-2.5 py-1.5 rounded shadow-lg flex flex-col items-center gap-0.5 z-10 animate-in fade-in zoom-in-95 duration-100"
                    style={{
                        left: `${(points[hoveredIdx].x / width) * 100}%`,
                        top: `${(points[hoveredIdx].y / height) * 100 - 8}%`,
                    }}
                >
                    <div className="font-semibold">{points[hoveredIdx].raw[labelKey]}</div>
                    <div className="text-primary-300 font-mono text-[11px]">
                        {points[hoveredIdx].val} {valueKey}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AreaTrendChart;

