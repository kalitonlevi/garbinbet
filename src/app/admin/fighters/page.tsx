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
import { Flag, Plus, Loader2, Trash2, Pencil, Upload } from "lucide-react";
import type { Fighter } from "@/types/database";

const fighterSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  nickname: z.string().optional(),
  fifa_code: z.string().optional(),
});

export default function AdminFightersPage() {
  const [fighters, setFighters] = useState<Fighter[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFighter, setEditingFighter] = useState<Fighter | null>(null);

  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [fifaCode, setFifaCode] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  const loadFighters = useCallback(async () => {
    const { data } = await supabase
      .from("fighters")
      .select("id, name, nickname, photo_url, fifa_code, created_at")
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
    setFifaCode("");
    setPhotoFile(null);
    setPhotoPreview(null);
    setDialogOpen(true);
  }

  function openEdit(f: Fighter) {
    setEditingFighter(f);
    setName(f.name);
    setNickname(f.nickname ?? "");
    setFifaCode(f.fifa_code ?? "");
    setPhotoFile(null);
    setPhotoPreview(f.photo_url);
    setDialogOpen(true);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 2MB");
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
      fifa_code: fifaCode || undefined,
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
          fifa_code: parsed.data.fifa_code?.toUpperCase() || null,
          photo_url: photoUrl,
        })
        .eq("id", editingFighter.id);
      if (error) toast.error(error.message);
      else {
        toast.success("Seleção atualizada!");
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
          fifa_code: parsed.data.fifa_code?.toUpperCase() || null,
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
        toast.success("Seleção cadastrada!");
        setDialogOpen(false);
        loadFighters();
      }
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover esta seleção?")) return;
    const { error } = await supabase.from("fighters").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Seleção removida");
      loadFighters();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flag className="h-6 w-6 text-[var(--brand-gold)]" />
          <h1 className="font-heading text-3xl text-[var(--text-primary)]">
            SELEÇÕES
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
            Nenhuma seleção cadastrada.
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
              {/* Flag */}
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
                  <Flag className="h-16 w-16 text-[var(--text-muted)]" />
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
                {f.fifa_code && (
                  <Badge
                    variant="outline"
                    className="text-[10px] border-[var(--brand-green)]/40 text-[var(--brand-green)]"
                  >
                    {f.fifa_code}
                  </Badge>
                )}
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
              {editingFighter ? "EDITAR SELEÇÃO" : "NOVA SELEÇÃO"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {editingFighter
                ? "Editar dados da seleção"
                : "Cadastrar nova seleção"}
            </DialogDescription>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Flag upload */}
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
                  Clique para {photoPreview ? "trocar" : "adicionar"} bandeira
                  (max 2MB)
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-[var(--text-secondary)]">País *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Brasil"
                  required
                  className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)]"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[var(--text-secondary)]">Apelido</Label>
                <Input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Opcional (ex: Canarinho)"
                  className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)]"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[var(--text-secondary)]">
                  Código FIFA
                </Label>
                <Input
                  value={fifaCode}
                  onChange={(e) => setFifaCode(e.target.value.toUpperCase())}
                  placeholder="Opcional (ex: BRA)"
                  maxLength={3}
                  className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)] uppercase"
                />
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
