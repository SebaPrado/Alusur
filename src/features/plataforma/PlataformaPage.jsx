import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  TextField,
  Typography,
} from "@mui/material";
import { supabase } from "../../lib/supabase";
import { useMisObras } from "../../obras/MisObrasProvider";
import { destinoAlCambiarOrg } from "../../org/organizacion";
import { useOrganizacion } from "../../org/OrganizacionProvider";

const AREAS = [
  { key: "construccion", label: "Construcción" },
  { key: "administracion", label: "Administración" },
];

function etiquetaAreas(areas) {
  return AREAS.filter((a) => areas?.includes(a.key))
    .map((a) => a.label)
    .join(" · ");
}

async function functionErrorMessage(fnErr, data) {
  if (data?.error) return String(data.error);
  if (!fnErr) return null;
  try {
    const body = await fnErr.context?.json?.();
    if (body?.error) return String(body.error);
  } catch {
    /* ignore */
  }
  try {
    const text = await fnErr.context?.text?.();
    if (text) {
      const parsed = JSON.parse(text);
      if (parsed?.error) return String(parsed.error);
    }
  } catch {
    /* ignore */
  }
  return fnErr.message || "No se pudo crear el dueño";
}

function AreasCheck({ value, onChange }) {
  return (
    <FormGroup>
      {AREAS.map((a) => (
        <FormControlLabel
          key={a.key}
          control={
            <Checkbox
              checked={value.includes(a.key)}
              onChange={(e) => {
                onChange(
                  e.target.checked
                    ? [...value, a.key]
                    : value.filter((k) => k !== a.key),
                );
              }}
            />
          }
          label={a.label}
        />
      ))}
    </FormGroup>
  );
}

export default function PlataformaPage() {
  const navigate = useNavigate();
  const { plataforma, organizaciones, ready, error, refresh, setOrgActiva } = useOrganizacion();
  const { obras } = useMisObras();
  const [duenos, setDuenos] = useState([]);
  const [duenosError, setDuenosError] = useState(null);
  const [nuevaOpen, setNuevaOpen] = useState(false);
  const [areasDlg, setAreasDlg] = useState(null);
  const [duenoDlg, setDuenoDlg] = useState(null);
  const [credencial, setCredencial] = useState(null);
  const [copiada, setCopiada] = useState(false);

  useEffect(() => {
    refresh();
    return () => {
      refresh();
    };
  }, [refresh]);

  useEffect(() => {
    if (!plataforma) return undefined;
    let cancelled = false;
    (async () => {
      const { data, error: err } = await supabase
        .from("admin_members")
        .select("organization_id, display_name")
        .eq("role", "dueno")
        .eq("active", true);
      if (cancelled) return;
      if (err) {
        setDuenosError(err.message);
        setDuenos([]);
        return;
      }
      setDuenosError(null);
      setDuenos(data ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [plataforma, organizaciones]);

  const filas = useMemo(
    () =>
      organizaciones.map((org) => ({
        ...org,
        obras: obras.filter((o) => o.organization_id === org.id).length,
        duenos: duenos
          .filter((d) => d.organization_id === org.id)
          .map((d) => d.display_name)
          .filter(Boolean),
      })),
    [organizaciones, obras, duenos],
  );

  if (!ready) {
    return (
      <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!plataforma) return <Navigate to="/" replace />;

  function entrar(org) {
    setOrgActiva(org.id);
    navigate(destinoAlCambiarOrg({ org, esObrero: false }));
  }

  return (
    <Box sx={{ maxWidth: 880, mx: "auto", px: { xs: 2, sm: 3 }, py: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, gap: 2 }}>
        <Typography variant="h5" fontWeight={700}>
          Plataforma
        </Typography>
        <Button variant="contained" onClick={() => setNuevaOpen(true)}>
          Nueva organización
        </Button>
      </Box>

      {error && (
        <Typography color="warning.main" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}
      {duenosError && (
        <Typography color="warning.main" sx={{ mb: 2 }}>
          No pude leer los dueños: {duenosError}
        </Typography>
      )}

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {filas.map((org) => (
          <Box
            key={org.id}
            sx={{
              border: 1,
              borderColor: "divider",
              p: 2,
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              gap: 2,
              justifyContent: "space-between",
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography fontWeight={600}>{org.nombre}</Typography>
              <Typography variant="body2" color="text.secondary">
                {etiquetaAreas(org.areas) || "Sin áreas"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {org.obras} {org.obras === 1 ? "obra" : "obras"}
                {" · "}
                {org.duenos.length > 0 ? org.duenos.join(", ") : "Sin dueño"}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
              <Button size="small" onClick={() => setAreasDlg(org)}>
                Editar áreas
              </Button>
              <Button size="small" onClick={() => setDuenoDlg(org)}>
                Agregar dueño
              </Button>
              <Button size="small" variant="outlined" onClick={() => entrar(org)}>
                Entrar
              </Button>
            </Box>
          </Box>
        ))}
      </Box>

      <NuevaOrganizacionDialog
        open={nuevaOpen}
        onClose={() => setNuevaOpen(false)}
        onCreated={refresh}
      />
      <AreasDialog
        org={areasDlg}
        onClose={() => setAreasDlg(null)}
        onSaved={async () => {
          setAreasDlg(null);
          await refresh();
        }}
      />
      <DuenoDialog
        org={duenoDlg}
        onClose={() => setDuenoDlg(null)}
        onCreated={(cred) => {
          setDuenoDlg(null);
          if (cred) {
            setCopiada(false);
            setCredencial(cred);
          }
          refresh();
        }}
      />
      <Dialog
        open={Boolean(credencial)}
        onClose={() => setCredencial(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Contraseña temporal</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {credencial?.fullName}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {credencial?.email}
          </Typography>
          <Typography
            sx={{
              fontFamily: "monospace",
              fontSize: "1.15rem",
              fontWeight: 600,
              letterSpacing: 1,
              wordBreak: "break-all",
              my: 1,
            }}
          >
            {credencial?.password}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Pasásela al dueño: se le va a pedir cambiarla al entrar.
          </Typography>
          <Button
            variant="outlined"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(credencial?.password ?? "");
                setCopiada(true);
              } catch {
                setCopiada(false);
              }
            }}
          >
            {copiada ? "Copiada" : "Copiar"}
          </Button>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setCredencial(null)}>
            Listo
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function NuevaOrganizacionDialog({ open, onClose, onCreated }) {
  const [nombre, setNombre] = useState("");
  const [areas, setAreas] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setNombre("");
    setAreas([]);
    setError(null);
    setBusy(false);
  }, [open]);

  async function guardar() {
    setError(null);
    if (!nombre.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    if (areas.length === 0) {
      setError("Elegí al menos un área");
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.rpc("crear_organizacion", {
      p_nombre: nombre.trim(),
      p_areas: areas,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    await onCreated();
    onClose();
  }

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Nueva organización</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <TextField
          label="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          autoFocus
          fullWidth
          margin="normal"
        />
        <AreasCheck value={areas} onChange={setAreas} />
        {error && (
          <Typography variant="body2" color="warning.main">
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={guardar} disabled={busy}>
          Crear
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function AreasDialog({ org, onClose, onSaved }) {
  const [areas, setAreas] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!org) return;
    setAreas(org.areas ?? []);
    setError(null);
    setBusy(false);
  }, [org]);

  async function guardar() {
    if (!org) return;
    if (areas.length === 0) {
      setError("Elegí al menos un área");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc("actualizar_areas_organizacion", {
      p_organizacion: org.id,
      p_areas: areas,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    await onSaved();
  }

  return (
    <Dialog open={Boolean(org)} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Áreas · {org?.nombre}</DialogTitle>
      <DialogContent>
        <AreasCheck value={areas} onChange={setAreas} />
        {error && (
          <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={guardar} disabled={busy}>
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function DuenoDialog({ org, onClose, onCreated }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!org) return;
    setFullName("");
    setEmail("");
    setError(null);
    setBusy(false);
  }, [org]);

  async function guardar() {
    if (!org) return;
    if (!fullName.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    if (!email.trim()) {
      setError("El mail es obligatorio");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("admin-users", {
        body: {
          action: "create_admin_member",
          organization_id: org.id,
          full_name: fullName.trim(),
          email: email.trim(),
          role: "dueno",
        },
      });
      const errMsg = await functionErrorMessage(fnErr, data);
      if (errMsg) throw new Error(errMsg);
      if (data?.temporary_password) {
        onCreated({
          fullName: fullName.trim(),
          email: email.trim(),
          password: data.temporary_password,
        });
      } else {
        onCreated(null);
      }
    } catch (e) {
      setError(e.message || "No se pudo crear el dueño");
      setBusy(false);
    }
  }

  return (
    <Dialog open={Boolean(org)} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Agregar dueño · {org?.nombre}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
        <TextField
          label="Nombre"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoFocus
          fullWidth
          margin="dense"
        />
        <TextField
          label="Mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          fullWidth
          margin="dense"
        />
        {error && (
          <Typography variant="body2" color="warning.main">
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={guardar} disabled={busy}>
          Crear
        </Button>
      </DialogActions>
    </Dialog>
  );
}
