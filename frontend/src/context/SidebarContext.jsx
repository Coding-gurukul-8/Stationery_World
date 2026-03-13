import { createContext, useContext, useState, useEffect } from "react";

const SidebarContext = createContext();

export const useSidebar = () => useContext(SidebarContext);

export const SidebarProvider = ({ children }) => {
  const [open, setOpen] = useState(() => {
    const saved = localStorage.getItem("admin-sidebar");
    return saved ? JSON.parse(saved) : true;
  });

  // persist state
  useEffect(() => {
    localStorage.setItem("admin-sidebar", JSON.stringify(open));
  }, [open]);

  return (
    <SidebarContext.Provider value={{ open, setOpen }}>
      {children}
    </SidebarContext.Provider>
  );
};
