"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface ChartData {
  name: string;
  [key: string]: string | number;
}

interface MetricsChartProps {
  title: string;
  description?: string;
  data: ChartData[];
  type?: "area" | "bar";
  dataKeys: { key: string; color: string; name?: string }[];
  xAxisKey?: string;
  valueSuffix?: string;
  height?: number;
}

export function MetricsChart({
  title,
  description,
  data,
  type = "area",
  dataKeys,
  xAxisKey = "name",
  valueSuffix = "",
  height = 300
}: MetricsChartProps) {
  
  const ChartComponent = type === "area" ? AreaChart : BarChart;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div style={{ height: `${height}px` }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ChartComponent data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                {type === "area" && dataKeys.map((dk) => (
                  <linearGradient key={`color-${dk.key}`} id={`color-${dk.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={dk.color} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={dk.color} stopOpacity={0}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis 
                dataKey={xAxisKey} 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: '#64748b' }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: '#64748b' }}
                tickFormatter={(val) => `${val}${valueSuffix}`}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value: number, name: string) => [
                  `${value}${valueSuffix}`, 
                  dataKeys.find(k => k.key === name)?.name || name
                ]}
              />
              {dataKeys.map((dk) => {
                if (type === "area") {
                  return (
                    <Area 
                      key={dk.key}
                      type="monotone" 
                      dataKey={dk.key} 
                      name={dk.name || dk.key}
                      stroke={dk.color} 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill={`url(#color-${dk.key})`} 
                    />
                  );
                }
                return (
                  <Bar 
                    key={dk.key}
                    dataKey={dk.key} 
                    name={dk.name || dk.key}
                    fill={dk.color} 
                    radius={[4, 4, 0, 0]}
                  />
                );
              })}
            </ChartComponent>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
