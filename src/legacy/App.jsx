import AppRoutes from "./routes/AppRoutes";
import ThemeProvider from "./components/ThemeProvider";
import IntroVideo from "./components/IntroVideo";

function App() {
  return (
    <ThemeProvider>
      <IntroVideo>
        <AppRoutes />
      </IntroVideo>
    </ThemeProvider>
  );
}

export default App;
