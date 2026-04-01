"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
  DialogDescription,
} from "@/components/ui/dialog";
import { Users, Plus, Loader2, Trash2, Pencil, Upload, X, User } from "lucide-react";
import type { Fighter } from "@/types/database";

const fighterSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  nickname: z.string().optional(),
  weight_kg: z.number().positive("Peso deve ser positivo").optional(),
});

export default function AdminFightersPage() {
  const [fighters, setFighters] = useState<Fighter[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFighter, setEditingFighter] = useState<Fighter | null>(null);

  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [weight, setWeight] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  const loadFighters = useCallback(async () => {
    const { data } = await supabase
      .from("fighters")
      .select("*")
      .order("name");
    setFighters(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadFighters();
  }, [loadFighters]);

  function openCreate() {
    setEditingFighter(null);
    setName("");
    setNickname("");
    setWeight("");
    setPhotoFile(null);
    setPhotoPreview(null);
    setDialogOpen(true);
  }

  function openEdit(f: Fighter) {
    setEditingFighter(f);
    setName(f.name);
    setNickname(f.nickname ?? "");
    setWeight(f.weight_kg ? String(f.weight_kg) : "");
    setPhotoFile(null);
    setPhotoPreview(f.photo_url);
    setDialogOpen(true);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem deve ter no maximo 2MB");
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function uploadPhoto(fighterId: string): Promise<string | null> {
    if (!photoFile) return editingFighter?.photo_url ?? null;

    const ext = photoFile.name.split(".").pop();
    const path = `${fighterId}.${ext}`;

    const { error } = await supabase.storage
      .from("fighters")
      .upload(path, photoFile, { upsert: true });

    if (error) {
      toast.error("Erro no upload: " + error.message);
      return null;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("fighters").getPublicUrl(path);
    return publicUrl;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const parsed = fighterSchema.safeParse({
      name,
      nickname: nickname || undefined,
      weight_kg: weight ? parseFloat(weight) : undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setSaving(true);

    if (editingFighter) {
      // Update
      const photoUrl = await uploadPhoto(editingFighter.id);
      const { error } = await supabase
        .from("fighters")
        .update({
          name: parsed.data.name,
          nickname: parsed.data.nickname || null,
          weight_kg: parsed.data.weight_kg ?? null,
          photo_url: photoUrl,
        })
        .eq("id", editingFighter.id);
      if (error) toast.error(error.message);
      else {
        toast.success("Lutador atualizado!");
        setDialogOpen(false);
        loadFighters();
      }
    } else {
      // Create
      const { data: newFighter, error } = await supabase
        .from("fighters")
        .insert({
          name: parsed.data.name,
          nickname: parsed.data.nickname || null,
          weight_kg: parsed.data.weight_kg ?? null,
        })
        .select()
        .single();
      if (error) {
        toast.error(error.message);
      } else {
        if (photoFile && newFighter) {
          const photoUrl = await uploadPhoto(newFighter.id);
          if (photoUrl) {
            await supabase
              .from("fighters")
              .update({ photo_url: photoUrl })
              .eq("id", newFighter.id);
          }
        }
        toast.success("Lutador cadastrado!");
        setDialogOpen(false);
        loadFighters();
      }
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover este lutador?")) return;
    const { error } = await supabase.from("fighters").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Lutador removido");
      loadFighters();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-[var(--brand-gold)]" />
          <h1 className="font-heading text-3xl text-[var(--text-primary)]">
            LUTADORES
          </h1>
        </div>
        <Button
          onClick={openCreate}
          className="bg-[var(--brand-green)] text-[var(--bg-primary)] hover:bg-[var(--brand-green)]/90 font-bold"
        >
          <Plus className="h-4 w-4 mr-1" />
          Cadastrar
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--brand-green)]" />
        </div>
      ) : fighters.length === 0 ? (
        <Card
          className="border-[var(--border-default)]"
          style={{ background: "var(--bg-card)" }}
        >
          <CardContent className="py-8 text-center text-[var(--text-muted)]">
            Nenhum lutador cadastrado.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {fighters.map((f) => (
            <Card
              key={f.id}
              className="border-[var(--border-default)] overflow-hidden group"
              style={{ background: "var(--bg-card)" }}
            >
              {/* Photo */}
              <div
                className="relative aspect-square flex items-center justify-center overflow-hidden"
                style={{ background: "var(--bg-elevated)" }}
              >
                {f.photo_url ? (
                  <Image
                    src={f.photo_url}
                    alt={f.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <User className="h-16 w-16 text-[var(--text-muted)]" />
                )}
                {/* Overlay buttons */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => openEdit(f)}
                    className="bg-[var(--brand-gold)] text-[var(--bg-primary)] h-8 w-8 p-0"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleDelete(f.id)}
                    className="bg-[var(--color-danger)] text-white h-8 w-8 p-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <CardContent className="py-3 px-3 space-y-1">
                <p className="font-semibold text-[var(--text-primary)] text-sm truncate">
                  {f.name}
                </p>
                {f.nickname && (
                  <p className="text-xs text-[var(--text-muted)] truncate">
                    &quot;{f.nickname}&quot;
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <Badge
                    variant="outline"
                    className="text-[10px] border-white/20 text-white"
                  >
                    FAIXA BRANCA
                  </Badge>
                  {f.weight_kg && (
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {f.weight_kg}kg
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent
            showCloseButton={false}
            className="max-w-md border-[var(--border-default)] p-6"
            style={{ background: "var(--bg-card)" }}
          >
            <DialogTitle className="font-heading text-2xl text-[var(--text-primary)] mb-4">
              {editingFighter ? "EDITAR LUTADOR" : "NOVO LUTADOR"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {editingFighter
                ? "Editar dados do lutador"
                : "Cadastrar novo lutador"}
            </DialogDescription>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Photo upload */}
              <div className="flex flex-col items-center gap-3">
                <div
                  className="relative h-24 w-24 rounded-full overflow-hidden cursor-pointer border-2 border-dashed border-[var(--border-default)] flex items-center justify-center"
                  style={{ background: "var(--bg-elevated)" }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {photoPreview ? (
                    <Image
                      src={photoPreview}
                      alt="Preview"
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <Upload className="h-8 w-8 text-[var(--text-muted)]" />
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <p className="text-xs text-[var(--text-muted)]">
                  Clique para {photoPreview ? "trocar" : "adicionar"} foto (max
                  2MB)
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-[var(--text-secondary)]">Nome *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome completo"
                  required
                  className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)]"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[var(--text-secondary)]">Apelido</Label>
                <Input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Opcional"
                  className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[var(--text-secondary)]">
                    Peso (kg)
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="75.5"
                    className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[var(--text-secondary)]">Faixa</Label>
                  <Input
                    value="Branca"
                    disabled
                    className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-muted)]"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <DialogClose
                  className="flex-1 h-10 rounded-lg border border-[var(--border-default)] text-[var(--text-secondary)] text-sm font-medium hover:bg-[var(--bg-elevated)] transition-colors"
                >
                  Cancelar
                </DialogClose>
                <Button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-[var(--brand-green)] text-[var(--bg-primary)] hover:bg-[var(--brand-green)]/90 font-bold"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : editingFighter ? (
                    "Salvar"
                  ) : (
                    "Cadastrar"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
      </Dialog>
    </div>
  );
}
