import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { supabase } from "../../lib/supabase";
import { useAdminOrg } from "./AdminOrgProvider";
import { formatCents } from "./money";
import ProductDialog from "./ProductDialog";
import { rpcErrorMessage } from "./rpcError";
import { parseMoneyToCents, parseQtyThousandths, qtyToInput } from "./saleMath";
import StockDialog from "./StockDialog";
import { useAdminToast } from "./toast";
import { useAdminRealtime } from "./useAdminRealtime";

const PRODUCT_TABLES = ["admin_products"];

function formatStock(value) {
  const th = parseQtyThousandths(value, { allowNegative: true });
  if (th == null) return value == null ? "" : String(value);
  return qtyToInput(th).replace(".", ",");
}

export default function ProductsPage() {
  const { organizationId, isManager } = useAdminOrg();
  const { showError, showSuccess } = useAdminToast();
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [stockProduct, setStockProduct] = useState(null);
  const [deleteProduct, setDeleteProduct] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!organizationId) return;
    const [products, cats] = await Promise.all([
      supabase
        .from("admin_products")
        .select(
          "id, name, sku, barcode, unit, currency, price, iva_rate, stock, category_id, active, admin_categories(name)",
        )
        .eq("organization_id", organizationId)
        .order("name"),
      supabase
        .from("admin_categories")
        .select("id, name")
        .eq("organization_id", organizationId)
        .order("name"),
    ]);
    if (products.error) showError(rpcErrorMessage(products.error));
    else setRows(products.data ?? []);
    if (cats.error) showError(rpcErrorMessage(cats.error));
    else setCategories(cats.data ?? []);
    setLoading(false);
  }, [organizationId, showError]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useAdminRealtime({ onTick: load, tables: PRODUCT_TABLES });

  async function confirmDelete() {
    if (!deleteProduct) return;
    setDeleting(true);
    const { data, error } = await supabase.rpc("admin_delete_product", {
      p_product_id: deleteProduct.id,
    });
    setDeleting(false);
    if (error) {
      showError(rpcErrorMessage(error));
      return;
    }
    showSuccess(
      data === "inactivo"
        ? "Tiene ventas: quedó inactivo y ya no se puede vender"
        : "Producto eliminado",
    );
    setDeleteProduct(null);
    load();
  }

  const q = search.trim().toLowerCase();
  const visible = q
    ? rows.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku ?? "").toLowerCase().includes(q),
      )
    : rows;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <Box sx={{ display: "flex", gap: 1, py: 1, alignItems: "center" }}>
        <TextField
          size="small"
          placeholder="Buscar por nombre o SKU"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 280 }}
        />
        <Box sx={{ flex: 1 }} />
        {isManager && (
          <Button
            size="small"
            variant="contained"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            + Nuevo producto
          </Button>
        )}
      </Box>
      <TableContainer sx={{ flex: 1, overflow: "auto" }}>
        <Table stickyHeader size="small" sx={{ "& td, & th": { fontSize: 13 } }}>
          <TableHead>
            <TableRow>
              <TableCell>Nombre</TableCell>
              <TableCell>SKU</TableCell>
              <TableCell>Categoría</TableCell>
              <TableCell>Unidad</TableCell>
              <TableCell align="right">Precio</TableCell>
              <TableCell align="right">Stock</TableCell>
              {isManager && <TableCell />}
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={isManager ? 7 : 6}>
                  <Typography variant="body2" color="text.secondary">
                    No hay productos
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {visible.map((p) => {
              const cents = parseMoneyToCents(p.price);
              return (
                <TableRow key={p.id} hover sx={{ opacity: p.active ? 1 : 0.55 }}>
                  <TableCell>
                    {p.name}
                    {p.active ? "" : " (inactivo)"}
                  </TableCell>
                  <TableCell>{p.sku ?? ""}</TableCell>
                  <TableCell>{p.admin_categories?.name ?? ""}</TableCell>
                  <TableCell>{p.unit}</TableCell>
                  <TableCell align="right">
                    {cents == null ? "" : formatCents(cents, p.currency)}
                  </TableCell>
                  <TableCell align="right">{formatStock(p.stock)}</TableCell>
                  {isManager && (
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      <Button
                        size="small"
                        onClick={() => {
                          setEditing(p);
                          setDialogOpen(true);
                        }}
                      >
                        Editar
                      </Button>
                      <Button size="small" onClick={() => setStockProduct(p)}>
                        Cargar stock
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        onClick={() => setDeleteProduct(p)}
                      >
                        Eliminar
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <ProductDialog
        open={dialogOpen}
        product={editing}
        categories={categories}
        onClose={() => setDialogOpen(false)}
        onSaved={load}
      />
      <StockDialog
        open={Boolean(stockProduct)}
        product={stockProduct}
        onClose={() => setStockProduct(null)}
        onSaved={load}
      />
      <Dialog
        open={Boolean(deleteProduct)}
        onClose={deleting ? undefined : () => setDeleteProduct(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Eliminar producto</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            ¿Eliminar {deleteProduct?.name}? Si ya se vendió, queda inactivo
            para no perder el historial.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteProduct(null)} disabled={deleting}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={confirmDelete}
            disabled={deleting}
          >
            {deleting ? "Eliminando…" : "Eliminar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
