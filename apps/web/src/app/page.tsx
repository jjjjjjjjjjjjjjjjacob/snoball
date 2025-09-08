export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center space-y-6 max-w-3xl">
        <h1 className="text-6xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">
          Snoball
        </h1>
        <p className="text-xl text-muted-foreground">
          AI-Powered Trading Platform with PDT Compliance
        </p>
        <div className="flex gap-4 justify-center pt-6">
          <a 
            href="/auth/signin"
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Sign In
          </a>
          <a 
            href="/auth/signin"
            className="px-6 py-3 border border-border rounded-lg hover:bg-muted transition-colors"
          >
            Get Started
          </a>
        </div>
      </div>
    </main>
  );
}