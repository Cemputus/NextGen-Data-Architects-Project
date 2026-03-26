/**
 * Design system tokens mirroring root CSS variables for programmatic use in charts & JS.
 */
export const colors = {
    primary: "hsl(222, 47%, 11%)",
    primaryForeground: "hsl(210, 40%, 98%)",
    secondary: "hsl(210, 40%, 96.1%)",
    secondaryForeground: "hsl(222.2, 47.4%, 11.2%)",
    accent: "hsl(262, 83%, 58%)",
    accentForeground: "hsl(210, 40%, 98%)",
    destructive: "hsl(0, 84.2%, 60.2%)",
    success: "hsl(142, 76%, 36%)",
    warning: "hsl(38, 92%, 50%)",
    muted: "hsl(215.4, 16.3%, 46.9%)",
    border: "hsl(214.3, 31.8%, 91.4%)",

    // Specific chart colors expanding the semantic palette
    chart: [
        "#0B1E48", // Dark Navy
        "#4A2CAD", // Violet/Indigo 
        "#1D4ED8", // Distinct Blue
        "#10B981", // Emerald
        "#EF4444", // Red
        "#F59E0B", // Amber
        "#8B5CF6", // Purple
        "#06B6D4", // Cyan
    ]
};

export const typography = {
    fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
};
