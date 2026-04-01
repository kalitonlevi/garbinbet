"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, LogOut, Loader2, User } from "lucide-react";
import type { Profile } from "@/types/database";

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [pixKey, setPixKey] = useState("");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setEmail(user.email ?? "");

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        setProfile(data);
        setFullName(data.full_name);
        setPhone(data.phone ?? "");
        setPixKey(data.pix_key ?? "");
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        phone: phone || null,
        pix_key: pixKey || null,
      })
      .eq("id", profile.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Perfil atualizado!");
      router.refresh();
    }
    setSaving(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[#7ED957]" />
      </div>
    );
  }

  const initial = fullName?.charAt(0)?.toUpperCase() ?? "?";

  return (
    <div className="space-y-6">
      {/* Avatar + name */}
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="h-20 w-20 rounded-full border-2 border-[#D4A017] flex items-center justify-center text-3xl font-heading text-[#D4A017]"
          style={{ background: "#1C1C28" }}>
          {initial}
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-[#F0F0F0]">{fullName}</p>
          <p className="text-xs text-[#6B6B80]">{email}</p>
        </div>
      </div>

      {/* Edit form */}
      <div
        className="rounded-xl border border-[#2A2A3A] p-4 space-y-4"
        style={{ background: "#16161F" }}
      >
        <div className="space-y-2">
          <Label className="text-[#9999AA] text-xs">Nome completo</Label>
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="bg-[#0A0A0F] border-[#2A2A3A] text-[#F0F0F0] focus:border-[#7ED957]"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-[#9999AA] text-xs">Email</Label>
          <Input
            value={email}
            disabled
            className="bg-[#0A0A0F] border-[#2A2A3A] text-[#6B6B80]"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-[#9999AA] text-xs">Telefone</Label>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(00) 00000-0000"
            className="bg-[#0A0A0F] border-[#2A2A3A] text-[#F0F0F0] placeholder:text-[#6B6B80] focus:border-[#7ED957]"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-[#9999AA] text-xs">Chave PIX</Label>
          <Input
            value={pixKey}
            onChange={(e) => setPixKey(e.target.value)}
            placeholder="CPF, email, telefone ou chave aleatoria"
            className="bg-[#0A0A0F] border-[#2A2A3A] text-[#F0F0F0] placeholder:text-[#6B6B80] focus:border-[#7ED957]"
          />
          <p className="text-[10px] text-[#6B6B80]">
            Usado para receber saques.
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-11 bg-[#7ED957] text-[#0A0A0F] hover:bg-[#7ED957]/90 font-bold"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Save className="h-4 w-4 mr-1.5" />
              Salvar
            </>
          )}
        </Button>
      </div>

      {/* Logout */}
      <Button
        variant="outline"
        onClick={handleLogout}
        className="w-full h-11 border-[#FF4757]/50 text-[#FF4757] hover:bg-[#FF4757]/10"
      >
        <LogOut className="h-4 w-4 mr-1.5" />
        Sair da Conta
      </Button>

      {/* Footer */}
      <div className="text-center pt-4 pb-2">
        <p className="text-[10px] text-[#6B6B80]">
          GARBINBET v1.0 — Exclusivo Faixa Branca 🥋
        </p>
      </div>
    </div>
  );
}
