import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import AppNavigator from "./src/navigation/AppNavigator";
import { useAuth } from "./src/lib/auth";

export default function App() {
  const init = useAuth((s) => s.init);

  useEffect(() => {
    init();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <AppNavigator />
    </>
  );
}
