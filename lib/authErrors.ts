export function getAuthErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof TypeError && error.message === "Failed to fetch") {
    return "Не удалось подключиться к Supabase. Проверьте NEXT_PUBLIC_SUPABASE_URL в .env.local — возьмите Project URL из Dashboard → Settings → API (формат: https://abcdefgh.supabase.co). После изменения перезапустите npm run dev.";
  }

  if (error instanceof Error && error.message) {
    const msg = error.message.toLowerCase();
    if (msg.includes("invalid login credentials")) {
      return "Неверный email или пароль. Если вы регистрировались без пароля — используйте «Забыли пароль?»";
    }
    if (msg.includes("email not confirmed")) {
      return "Email ещё не подтверждён. Напишите в поддержку или зарегистрируйтесь заново — подтверждение почты для входа больше не требуется.";
    }
    return error.message;
  }

  return fallback;
}
