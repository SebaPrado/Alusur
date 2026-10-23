import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  typography: {
    fontFamily: '"Montserrat", sans-serif',
  },
  palette: {
    mode: "dark",
    primary: {
      main: "#249596",
      contrastText: "#0E1117",
    },
    warning: {
      main: "#E3A63B",
    },
    error: {
      main: "#C45C5C",
    },
    background: {
      default: "#0E1117",
      paper: "#1E2736",
    },
    text: {
      primary: "#F2F4F7",
      secondary: "#A9B3C1",
    },
    divider: "#2E3A4E",
  },
  shape: {
    borderRadius: 0,
  },
  components: {
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiAppBar: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiCard: {
      defaultProps: {
        elevation: 0,
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          textTransform: "none",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 0,
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 0,
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 700,
          "&.Mui-selected": {
            backgroundColor: "#249596",
            color: "#0E1117",
          },
          "&.Mui-selected:hover": {
            backgroundColor: "#249596",
          },
        },
      },
    },
  },
});
