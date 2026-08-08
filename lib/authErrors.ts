export function getAuthErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof TypeError && error.message === "Failed to fetch") {
    return "Сеть оборвалась при входе. Обнови страницу и попробуй ещё раз (лучше Chrome, не встроенный браузер мессенджера).";
  }

  if (error instanceof Error && error.message) {
    const msg = error.message.toLowerCase();
    if (msg === "timeout" || msg.includes("timed out") || msg.includes("timeout")) {
      return "Вход занял слишком много времени. Обнови страницу и войди ещё раз.";
    }
    if (msg.includes("invalid login credentials")) {
      return "Неверный email или пароль. Если вы регистрировались без пароля — используйте «Забыли пароль?»";
    }
    if (msg.includes("email not confirmed")) {
      return "Email ещё не подтверждён. Откройте письмо со ссылкой или нажмите «Отправить ещё раз» на странице регистрации.";
    }
    return error.message;
  }

  return fallback;
}

export async function withAuthTimeout<T>(
  promise: PromiseLike<T>,
  ms = 20000
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
