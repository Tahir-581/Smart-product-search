import { useState } from "react";
import products from "./products";

const categorySynonyms = {
  "running shoes": ["running shoes", "sneakers", "trainers"],
  headphones: ["headphones", "earbuds", "headsets"],
  laptops: ["laptops", "notebooks", "computers"],
};

function App() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredProducts, setFilteredProducts] = useState(products);
  const [loading, setLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState(null);

  const matchesCategory = (productCategory, filterCategory) => {
    if (!filterCategory) return true;
    const synonyms =
      categorySynonyms[filterCategory.toLowerCase()] || [filterCategory.toLowerCase()];
    return synonyms.some((syn) =>
      productCategory.toLowerCase().includes(syn)
    );
  };

  const simpleKeywordFilter = (query) => {
    const q = query.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
    );
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setFilteredProducts(products);
      setAiResponse(null);
      return;
    }

    setLoading(true);
    setAiResponse(null);

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `
You are a product search assistant. Given the user's search query, respond with JSON ONLY with keys:  
- category (string or null)  
- maxPrice (number or null)  
- minRating (number or null)  

DO NOT provide any explanations or extra text.  
If a key is not mentioned, set it to null.

Example output:  
{"category":"running shoes","maxPrice":100,"minRating":4}
              `.trim(),
            },
            { role: "user", content: searchQuery },
          ],
          temperature: 0,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("OpenAI API error:", response.status, errText);
        setFilteredProducts(simpleKeywordFilter(searchQuery));
        setLoading(false);
        return;
      }

      const data = await response.json();
      const rawContent = data.choices?.[0]?.message?.content.trim() || "";
      let content = rawContent;

      if (content.startsWith("```")) {
        content = content.replace(/```json?/, "").replace(/```$/, "").trim();
      }

      setAiResponse(content);

      let filters = { category: null, maxPrice: null, minRating: null };
      try {
        filters = JSON.parse(content);
      } catch (e) {
        console.error("JSON parse error from AI response:", e);
        setFilteredProducts(simpleKeywordFilter(searchQuery));
        setLoading(false);
        return;
      }

      products.forEach((p) => {
        const catMatch = matchesCategory(p.category, filters.category);
        const priceMatch = filters.maxPrice ? p.price <= filters.maxPrice : true;
        const ratingMatch = filters.minRating ? p.rating >= filters.minRating : true;
        console.log(
          `${p.name} | Category match: ${catMatch} | Price match: ${priceMatch} | Rating match: ${ratingMatch}`
        );
      });

      const results = products.filter((p) => {
        return (
          matchesCategory(p.category, filters.category) &&
          (filters.maxPrice ? p.price <= filters.maxPrice : true) &&
          (filters.minRating ? p.rating >= filters.minRating : true)
        );
      });

      setFilteredProducts(results);
    } catch (error) {
      console.error("Search error:", error);
      setFilteredProducts(simpleKeywordFilter(searchQuery));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <h1>🛒 AI Product Catalog</h1>

      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder='Search e.g. "running shoes under $100 with 4 stars"'
        style={{ padding: 8, width: 300 }}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSearch();
        }}
      />
      <button onClick={handleSearch} disabled={loading} style={{ marginLeft: 10, padding: "8px 12px" }}>
        {loading ? "Searching..." : "Search"}
      </button>

      {loading && <p>Searching...</p>}

      {aiResponse && (
        <pre
          style={{
            backgroundColor: "#f0f0f0",
            padding: 10,
            borderRadius: 6,
            marginTop: 10,
            whiteSpace: "pre-wrap",
          }}
        >
          AI JSON Response: {aiResponse}
        </pre>
      )}

      {filteredProducts.length === 0 && !loading && <p>No products found.</p>}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))",
          gap: 10,
          marginTop: 20,
        }}
      >
        {filteredProducts.map((p) => (
          <div
            key={p.name}
            style={{ border: "1px solid #ccc", padding: 10, borderRadius: 8 }}
          >
            <h3>{p.name}</h3>
            <p>💰 ${p.price}</p>
            <p>📦 {p.category}</p>
            <p>⭐ {p.rating}</p>
            <p>{p.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
