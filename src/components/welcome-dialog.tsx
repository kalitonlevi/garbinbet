"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trophy } from "lucide-react";

export function WelcomeDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem("welcome-dismissed");
    if (!dismissed) {
      setOpen(true);
    }
  }, []);

  function handleClose() {
    sessionStorage.setItem("welcome-dismissed", "1");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent showCloseButton={false} className="text-center">
        <DialogHeader className="items-center gap-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#D4A017]/10">
            <Trophy className="h-8 w-8 text-[#D4A017]" />
          </div>
          <DialogTitle className="text-2xl text-[#D4A017]">
            Bem-vindo ao GarbinBet!
          </DialogTitle>
          <DialogDescription className="text-[#9999AA] text-sm leading-relaxed">
            No momento ainda não temos lutas agendadas, mas fique tranquilo!
            Em breve as lutas serão marcadas e estarão disponíveis para você apostar.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="border-0 bg-transparent sm:justify-center">
          <Button
            onClick={handleClose}
            className="w-full bg-[#D4A017] hover:bg-[#D4A017]/90 text-black font-bold"
          >
            Entendi!
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
