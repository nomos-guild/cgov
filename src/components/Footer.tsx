import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border glass mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-lg font-semibold mb-4">CGOV</h3>
            <p className="text-sm text-muted-foreground">
              Built by Nomos | Mesh & SIDAN Lab.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

