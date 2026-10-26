import { useState } from 'react';

const BarChart = ({ data = [], height = 240, labelKey = 'label', valueKey = 'value', barColor = '#4f46e5' }) => {
    const [hoveredIdx, setHoveredIdx] = useState(null);

    if (!data || data.length === 0) {
        return (
            <div className="flex h-56 items-center justify-center text-slate-400 text-sm">
                No data available
            </div>
        );
    }

    const width = 500;
    const paddingX = 35;
    const paddingBottom = 40;
    const paddingTop = 25;
    const graphWidth = width - paddingX * 2;
    const graphHeight = height - paddingBottom - paddingTop;

    const values = data.map(d => Number(d[valueKey]) || 0);
    const maxVal = Math.max(...values, 5);

    const barGroupWidth = graphWidth / data.length;
    const barWidth = Math.min(Math.max(barGroupWidth * 0.55, 14), 42);

    return (
        <div className="relative w-full overflow-hidden select-none">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
                {/* Horizontal reference lines */}
                {[0, 0.5, 1].map((ratio, idx) => {
                    const y = paddingTop + graphHeight * (1 - ratio);
                    const val = Math.round(maxVal * ratio);
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

                {/* Bars */}
                {data.map((item, idx) => {
                    const val = Number(item[valueKey]) || 0;
                    const barH = (val / maxVal) * graphHeight;
                    const x = paddingX + idx * barGroupWidth + (barGroupWidth - barWidth) / 2;
                    const y = paddingTop + graphHeight - barH;

                    const isHovered = hoveredIdx === idx;

                    return (
                        <g
                            key={idx}
                            onMouseEnter={() => setHoveredIdx(idx)}
                            onMouseLeave={() => setHoveredIdx(null)}
                            className="cursor-pointer"
                        >
                            {/* Bar background track */}
                            <rect
                                x={x}
                                y={paddingTop}
                                width={barWidth}
                                height={graphHeight}
                                rx="4"
                                fill="#f8fafc"
                            />

                            {/* Actual Bar */}
                            <rect
                                x={x}
                                y={y}
                                width={barWidth}
                                height={Math.max(barH, 3)}
                                rx="4"
                                fill={isHovered ? '#4338ca' : barColor}
                                className="transition-colors duration-150"
                            />

                            {/* X-axis Label */}
                            <text
                                x={x + barWidth / 2}
                                y={height - 14}
                                textAnchor="middle"
                                fontSize="11"
                                fill={isHovered ? '#0f172a' : '#64748b'}
                                fontWeight={isHovered ? '600' : '400'}
                                className="truncate"
                            >
                                {String(item[labelKey]).slice(0, 10)}
                            </text>

                            {/* Value label on top of bar */}
                            {val > 0 && (
                                <text
                                    x={x + barWidth / 2}
                                    y={y - 5}
                                    textAnchor="middle"
                                    fontSize="10"
                                    fill={isHovered ? '#4338ca' : '#64748b'}
                                    fontWeight="600"
                                    className="font-mono"
                                >
                                    {val}
                                </text>
                            )}
                        </g>
                    );
                })}
            </svg>

            {/* Hover Tooltip */}
            {hoveredIdx !== null && (
                <div
                    className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-full bg-slate-900 text-white text-xs px-2.5 py-1.5 rounded shadow-lg flex flex-col items-center gap-0.5 z-10 animate-in fade-in zoom-in-95 duration-100"
                    style={{
                        left: `${((paddingX + hoveredIdx * barGroupWidth + barGroupWidth / 2) / width) * 100}%`,
                        top: '15%',
                    }}
                >
                    <div className="font-semibold">{data[hoveredIdx][labelKey]}</div>
                    <div className="text-indigo-300 font-mono text-[11px]">
                        {data[hoveredIdx][valueKey]} employees
                    </div>
                </div>
            )}
        </div>
    );
};

export default BarChart;

