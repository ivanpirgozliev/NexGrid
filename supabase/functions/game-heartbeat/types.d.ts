declare module "jsr:@supabase/functions-js/edge-runtime.d.ts";

declare module "npm:@supabase/supabase-js@2" {
  export * from "@supabase/supabase-js";
}

declare namespace Deno {
  namespace env {
    function get(key: string): string | undefined;
  }

  function serve(
    handler: (req: Request) => Response | Promise<Response>
  ): void;
}
