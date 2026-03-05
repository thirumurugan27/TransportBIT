/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend:{
            colors: 
            {
                // primarybg: '#EEF1F9',
                secondarybg: '#FFFFFF',
                primary: '#7D53F6',
                primarydull: '#9F74F7',
                green: '#008000',
                pending: '#F0B041',
                red: '#FF5555',
                primarytext: '#000000',
                secondarytext: '#5F6388',
                scroll: '#D1D1D1',
                scrollHover: '#9CA3AF',
                skyblue:"#0388FC",
            },
            fontFamily: {
                sans: ["Outfit", "Inter", "system-ui", "sans-serif"],
            },
        },
    },
    plugins: [],
}
