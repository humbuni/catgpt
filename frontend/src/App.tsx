import Chat from "./Chat";

export default function App() {
  return (
    <div
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
      }}
    >
      {/* sticky header */}
      <h1 className="header" style={{ margin: "0 0 1rem" }}>🐱 CatGPT</h1>
      <Chat />
    </div>
  );
}
