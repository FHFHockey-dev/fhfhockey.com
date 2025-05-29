// /Users/tim/Desktop/fhfhockey.com/web/pages/game-grid/index.tsx
export const getServerSideProps = async () => {
  return {
    redirect: {
      destination: "/game-grid/7-Day-Forecast",
      permanent: false // Set to true if this redirect is permanent
    }
  };
};

const GameGridIndexPage = () => {
  // This component will not be rendered on the server-side due to the redirect.
  // It can be null or a simple placeholder if needed for any client-side scenarios,
  // though with a server-side redirect, it's unlikely to be reached.
  return null;
};

export default GameGridIndexPage;
