import * as React from "react";
import { SidebarContext, SidebarContextProps } from "./sidebar.context"; // Ensure SidebarContextProps is imported if needed by the hook's return type, or adjust as necessary

export const useSidebar = (): SidebarContextProps => {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};
