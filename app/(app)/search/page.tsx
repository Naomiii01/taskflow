import type { Metadata } from "next";

import { SearchClient } from "./search-client";

export const metadata: Metadata = { title: "搜尋中心" };

export default function SearchPage() {
  return <SearchClient />;
}
