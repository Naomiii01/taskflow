export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold">
            TF
          </div>
          <h1 className="text-lg font-semibold">TaskFlow</h1>
          <p className="text-sm text-muted-foreground">AI 工作追蹤與跨部門協作系統</p>
        </div>
        {children}
      </div>
    </div>
  );
}
