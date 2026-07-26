import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

export const metadata = {
  title: "Реквизиты — WebComet",
  description: "Реквизиты самозанятого для оплаты услуг WebComet",
};

export default function RequisitesPage() {
  return (
    <div className="wc-atmosphere min-h-dvh px-4 py-10 text-white sm:px-6 sm:py-14">
      <div className="mx-auto w-full max-w-2xl">
        <Link href="/" className="inline-block">
          <BrandLogo size="sm" />
        </Link>

        <h1 className="mt-10 font-display text-3xl tracking-tight text-zinc-50">
          Реквизиты
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-zinc-400">
          Оплата услуг платформы WebComet (генерация сайтов, токены, публикация).
        </p>

        <div className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-[15px] leading-relaxed text-zinc-200">
          <p>
            <span className="text-zinc-500">Статус:</span> самозанятый
          </p>
          <p>
            <span className="text-zinc-500">ИНН:</span>{" "}
            <span className="font-medium tracking-wide text-zinc-50">
              263412410319
            </span>
          </p>
          <p>
            <span className="text-zinc-500">Сайт:</span>{" "}
            <a
              href="https://webcomet.ru"
              className="text-violet-300 hover:underline"
            >
              https://webcomet.ru
            </a>
          </p>
          <p>
            <span className="text-zinc-500">Поддержка:</span>{" "}
            <a
              href="mailto:support@webcomet.app"
              className="text-violet-300 hover:underline"
            >
              support@webcomet.app
            </a>
          </p>
        </div>

        <p className="mt-8 text-[13px] text-zinc-600">
          <Link href="/" className="hover:text-zinc-400">
            ← На главную
          </Link>
        </p>
      </div>
    </div>
  );
}
