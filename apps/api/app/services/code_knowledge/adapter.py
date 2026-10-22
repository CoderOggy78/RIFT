import os
import sys
import json
import time
import shutil
import subprocess
from pathlib import Path
from collections import Counter, defaultdict, deque
from typing import Dict, Any, List, Optional, Tuple, Set

from app.core.config import settings
from app.schemas.schemas import (
    CodeKnowledgeStatusResponse,
    CodeKnowledgeNode,
    CodeKnowledgeEdge,
    CodeCommunitySummary,
    CodeKnowledgeGraphResponse,
    CodeKnowledgeQueryResponse,
    CodeKnowledgeExplainResponse,
    CodeKnowledgeRefreshResponse,
    FilePreviewResponse,
    CodeCitation,
    ImpactStatus,
    OperationType,
    FileOperationEvent,
    DiscoveredTestSuite,
    ValidationRunRequest,
    ValidationRunResult,
    CodeImpactRelationship,
    CodeImpactRequest,
    CodeImpactResponse,
    IncidentCodeImpactResponse,
    TraceCodeImpactResponse,
)



class CodeKnowledgeService:
    def __init__(self):
        self._is_updating = False
        self._cached_graph: Optional[Dict[str, Any]] = None
        self._cached_mtime: float = 0.0

    def get_executable_path(self) -> Optional[str]:
        """Resolves the graphify executable safely without shell execution."""
        configured = settings.GRAPHIFY_EXECUTABLE_PATH
        if configured and os.path.isfile(configured) and os.access(configured, os.X_OK):
            return configured
        which_path = shutil.which("graphify")
        if which_path and os.path.isfile(which_path) and os.access(which_path, os.X_OK):
            return which_path
        # Also check ~/.local/bin/graphify
        local_bin = os.path.expanduser("~/.local/bin/graphify")
        if os.path.isfile(local_bin) and os.access(local_bin, os.X_OK):
            return local_bin
        return None

    def get_status(self) -> CodeKnowledgeStatusResponse:
        """Determines the exact state of Codebase Knowledge integration."""
        if not settings.ENABLE_CODEBASE_KNOWLEDGE:
            return CodeKnowledgeStatusResponse(
                status="disabled",
                is_enabled=False,
                is_installed=self.get_executable_path() is not None,
                message="Codebase Knowledge feature is disabled by configuration.",
            )

        exe = self.get_executable_path()
        if not exe:
            return CodeKnowledgeStatusResponse(
                status="not_installed",
                is_enabled=True,
                is_installed=False,
                message="Graphify CLI is not found or not executable. Run 'uv tool install graphifyy'.",
            )

        if self._is_updating:
            return CodeKnowledgeStatusResponse(
                status="updating",
                is_enabled=True,
                is_installed=True,
                message="Graphify knowledge graph is currently updating...",
            )

        graph_path = os.path.abspath(settings.GRAPHIFY_GRAPH_PATH)
        if not os.path.isfile(graph_path):
            return CodeKnowledgeStatusResponse(
                status="graph_not_generated",
                is_enabled=True,
                is_installed=True,
                graph_path=graph_path,
                message="Graphify is installed, but no graph has been generated yet for this repository.",
            )

        # Inspect graph.json safely
        try:
            data = self._load_graph(graph_path)
            nodes = data.get("nodes", [])
            links = data.get("links", [])
            meta = data.get("graph", {})
            schema_ver = meta.get("schema_version") if isinstance(meta, dict) else None
            graphify_ver = meta.get("graphify_version") if isinstance(meta, dict) else None

            # Communities count
            communities = {n.get("community") for n in nodes if n.get("community") is not None}

            mtime = os.path.getmtime(graph_path)
            last_updated = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(mtime))

            return CodeKnowledgeStatusResponse(
                status="ready",
                is_enabled=True,
                is_installed=True,
                graphify_version=graphify_ver or "unknown",
                graph_path=graph_path,
                schema_version=schema_ver,
                node_count=len(nodes),
                edge_count=len(links),
                community_count=len(communities),
                last_updated_at=last_updated,
                message="Graphify codebase knowledge graph is ready and verified.",
            )
        except Exception as exc:
            return CodeKnowledgeStatusResponse(
                status="error",
                is_enabled=True,
                is_installed=True,
                graph_path=graph_path,
                message=f"Graph file is invalid or malformed: {str(exc)}",
            )

    def _load_graph(self, path: str) -> Dict[str, Any]:
        """Loads and caches the graph JSON in memory, updating only on file modification."""
        mtime = os.path.getmtime(path)
        if self._cached_graph is not None and self._cached_mtime == mtime:
            return self._cached_graph

        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        if not isinstance(data, dict) or "nodes" not in data:
            raise ValueError("Malformed graph.json: missing 'nodes' collection")

        self._cached_graph = data
        self._cached_mtime = mtime
        return data

    def query(self, query_text: str, seed: Optional[str] = None, budget: int = 2000) -> CodeKnowledgeQueryResponse:
        """Safely queries the codebase knowledge graph."""
        start_time = time.perf_counter()
        status_info = self.get_status()
        if status_info.status != "ready":
            return CodeKnowledgeQueryResponse(
                query=query_text,
                status=status_info.status,
                raw_summary=status_info.message,
                duration_ms=0.0,
            )

        # Sanitize query input
        clean_query = query_text.strip()
        if not clean_query or len(clean_query) > 500:
            return CodeKnowledgeQueryResponse(
                query=query_text,
                status="invalid_input",
                raw_summary="Query must be between 1 and 500 characters.",
                duration_ms=0.0,
            )

        graph_path = os.path.abspath(settings.GRAPHIFY_GRAPH_PATH)
        data = self._load_graph(graph_path)
        nodes = data.get("nodes", [])
        links = data.get("links", [])

        # Match nodes based on query terms
        terms = [t.lower() for t in clean_query.split() if len(t) > 1]
        if not terms:
            terms = [clean_query.lower()]

        matched_nodes: List[Dict[str, Any]] = []
        for n in nodes:
            label = (n.get("label") or "").lower()
            norm = (n.get("norm_label") or "").lower()
            nid = (n.get("id") or "").lower()
            src = (n.get("source_file") or "").lower()

            score = 0
            for t in terms:
                if t in label or t in norm or t in nid:
                    score += 2
                elif t in src:
                    score += 1
            if score > 0:
                matched_nodes.append((score, n))

        matched_nodes.sort(key=lambda x: x[0], reverse=True)
        top_nodes = [item[1] for item in matched_nodes[:50]]
        top_node_ids = {n.get("id") for n in top_nodes}

        # Gather induced and incident edges
        matched_edges: List[Dict[str, Any]] = []
        for l in links:
            s = l.get("source")
            t = l.get("target")
            if s in top_node_ids or t in top_node_ids:
                matched_edges.append(l)
                if len(matched_edges) >= 150:
                    break

        # Convert to response schemas
        res_nodes: List[CodeKnowledgeNode] = []
        for n in top_nodes:
            res_nodes.append(CodeKnowledgeNode(
                id=n.get("id", ""),
                label=n.get("label", ""),
                file_type=n.get("file_type"),
                source_file=n.get("source_file"),
                source_location=n.get("source_location"),
                community=n.get("community"),
                community_name=n.get("community_name"),
                degree=n.get("degree"),
            ))

        res_edges: List[CodeKnowledgeEdge] = []
        for e in matched_edges:
            res_edges.append(CodeKnowledgeEdge(
                source=e.get("source", ""),
                target=e.get("target", ""),
                relation=e.get("relation", "relates_to"),
                confidence=e.get("confidence", "EXTRACTED"),
                confidence_score=float(e.get("confidence_score", 1.0)),
                source_file=e.get("source_file"),
                source_location=e.get("source_location"),
            ))

        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        summary = f"Found {len(res_nodes)} code entities and {len(res_edges)} relationships matching '{clean_query}'."

        return CodeKnowledgeQueryResponse(
            query=clean_query,
            status="success",
            nodes=res_nodes,
            edges=res_edges,
            raw_summary=summary,
            duration_ms=duration_ms,
        )

    def explain(self, symbol: str) -> CodeKnowledgeExplainResponse:
        """Provides focused concept and neighbor explanation with exact provenance."""
        status_info = self.get_status()
        if status_info.status != "ready":
            return CodeKnowledgeExplainResponse(symbol=symbol)

        clean_symbol = symbol.strip()
        graph_path = os.path.abspath(settings.GRAPHIFY_GRAPH_PATH)
        data = self._load_graph(graph_path)
        nodes = data.get("nodes", [])
        links = data.get("links", [])

        # Find target node
        target_node = None
        lower_sym = clean_symbol.lower()
        for n in nodes:
            if (n.get("label") or "").lower() == lower_sym or (n.get("id") or "").lower() == lower_sym:
                target_node = n
                break

        if not target_node:
            for n in nodes:
                if lower_sym in (n.get("label") or "").lower() or lower_sym in (n.get("id") or "").lower():
                    target_node = n
                    break

        if not target_node:
            return CodeKnowledgeExplainResponse(symbol=clean_symbol, raw_output=f"Node '{clean_symbol}' not found in knowledge graph.")

        nid = target_node.get("id")
        incoming: List[CodeKnowledgeEdge] = []
        outgoing: List[CodeKnowledgeEdge] = []

        for l in links:
            if l.get("target") == nid:
                incoming.append(CodeKnowledgeEdge(
                    source=l.get("source", ""),
                    target=l.get("target", ""),
                    relation=l.get("relation", "uses"),
                    confidence=l.get("confidence", "EXTRACTED"),
                    confidence_score=float(l.get("confidence_score", 1.0)),
                    source_file=l.get("source_file"),
                    source_location=l.get("source_location"),
                ))
            elif l.get("source") == nid:
                outgoing.append(CodeKnowledgeEdge(
                    source=l.get("source", ""),
                    target=l.get("target", ""),
                    relation=l.get("relation", "uses"),
                    confidence=l.get("confidence", "EXTRACTED"),
                    confidence_score=float(l.get("confidence_score", 1.0)),
                    source_file=l.get("source_file"),
                    source_location=l.get("source_location"),
                ))

        res_node = CodeKnowledgeNode(
            id=target_node.get("id", ""),
            label=target_node.get("label", ""),
            file_type=target_node.get("file_type"),
            source_file=target_node.get("source_file"),
            source_location=target_node.get("source_location"),
            community=target_node.get("community"),
            community_name=target_node.get("community_name"),
            degree=target_node.get("degree"),
        )

        return CodeKnowledgeExplainResponse(
            symbol=clean_symbol,
            node=res_node,
            incoming_edges=incoming[:30],
            outgoing_edges=outgoing[:30],
            raw_output=f"Concept '{target_node.get('label')}' ({target_node.get('source_file')}) has {len(incoming)} incoming and {len(outgoing)} outgoing connections.",
        )

    def refresh_graph(self) -> CodeKnowledgeRefreshResponse:
        """Executes a bounded, safe graphify extract --code-only command."""
        exe = self.get_executable_path()
        if not exe:
            return CodeKnowledgeRefreshResponse(
                success=False,
                message="Graphify executable not found. Cannot refresh graph.",
            )

        if self._is_updating:
            return CodeKnowledgeRefreshResponse(
                success=False,
                message="Graph refresh is already in progress.",
            )

        start = time.perf_counter()
        self._is_updating = True
        try:
            # Stage 1: extract code-only
            cmd_extract = [exe, "extract", ".", "--code-only"]
            proc = subprocess.run(
                cmd_extract,
                cwd=settings.REPO_ROOT,
                capture_output=True,
                text=True,
                timeout=60,
                shell=False,
            )
            if proc.returncode != 0:
                return CodeKnowledgeRefreshResponse(
                    success=False,
                    message=f"Graphify extraction failed (exit {proc.returncode}): {proc.stderr[:300]}",
                )

            # Stage 2: cluster without LLM
            cmd_cluster = [exe, "cluster-only", ".", "--no-label"]
            proc_cluster = subprocess.run(
                cmd_cluster,
                cwd=settings.REPO_ROOT,
                capture_output=True,
                text=True,
                timeout=30,
                shell=False,
            )

            # Reload cached graph
            self._cached_graph = None
            graph_path = os.path.abspath(settings.GRAPHIFY_GRAPH_PATH)
            data = self._load_graph(graph_path)
            nodes = data.get("nodes", [])
            links = data.get("links", [])
            dur = round((time.perf_counter() - start) * 1000, 2)

            return CodeKnowledgeRefreshResponse(
                success=True,
                message="Graphify knowledge graph regenerated successfully.",
                duration_ms=dur,
                node_count=len(nodes),
                edge_count=len(links),
            )
        except subprocess.TimeoutExpired:
            return CodeKnowledgeRefreshResponse(
                success=False,
                message="Graph refresh timed out after 60 seconds.",
            )
        except Exception as exc:
            return CodeKnowledgeRefreshResponse(
                success=False,
                message=f"Error refreshing graph: {str(exc)}",
            )
        finally:
            self._is_updating = False

    def get_communities(self) -> List[CodeCommunitySummary]:
        """Returns detected Louvain modularity communities with top hub symbols."""
        status_info = self.get_status()
        if status_info.status != "ready":
            return []
        try:
            graph_path = os.path.abspath(settings.GRAPHIFY_GRAPH_PATH)
            data = self._load_graph(graph_path)
            raw_nodes = data.get("nodes", [])
            raw_links = data.get("links", [])
            degree_map = Counter()
            for l in raw_links:
                degree_map[l.get("source")] += 1
                degree_map[l.get("target")] += 1
            comm_nodes = defaultdict(list)
            for n in raw_nodes:
                cid = n.get("community")
                if cid is not None:
                    comm_nodes[cid].append(n)
            res = []
            for cid, nlist in sorted(comm_nodes.items(), key=lambda x: len(x[1]), reverse=True):
                cname = nlist[0].get("community_name") or f"Community {cid}"
                top_syms = [s.get("label", "") for s in sorted(nlist, key=lambda n: degree_map[n.get("id")], reverse=True)[:4]]
                res.append(CodeCommunitySummary(id=cid, name=cname, node_count=len(nlist), top_symbols=top_syms))
            return res
        except Exception:
            return []

    def get_graph(
        self,
        community: Optional[int] = None,
        search: Optional[str] = None,
        focus_file: Optional[str] = None,
        focus_node: Optional[str] = None,
        node_type: Optional[str] = None,
        relation_type: Optional[str] = None,
        confidence: Optional[str] = None,
        max_nodes: int = 150,
        depth: int = 1,
    ) -> CodeKnowledgeGraphResponse:
        """
        Extracts a responsive, bounded subgraph with community clusters,
        targeted neighborhood expansion, and exact provenance preservation.
        """
        start_time = time.perf_counter()
        status_info = self.get_status()
        if status_info.status != "ready":
            return CodeKnowledgeGraphResponse(
                status=status_info.status,
                message=status_info.message,
                total_nodes=0,
                total_edges=0,
                communities=[],
            )

        try:
            graph_path = os.path.abspath(settings.GRAPHIFY_GRAPH_PATH)
            data = self._load_graph(graph_path)
            raw_nodes = data.get("nodes", [])
            raw_links = data.get("links", [])

            total_nodes = len(raw_nodes)
            total_edges = len(raw_links)

            # Pre-compute degrees & node map
            degree_map = Counter()
            for l in raw_links:
                degree_map[l.get("source")] += 1
                degree_map[l.get("target")] += 1

            node_by_id = {n.get("id"): n for n in raw_nodes if n.get("id")}

            # Compute community summaries
            comm_nodes = defaultdict(list)
            for n in raw_nodes:
                cid = n.get("community")
                if cid is not None:
                    comm_nodes[cid].append(n)

            communities_summary: List[CodeCommunitySummary] = []
            for cid, nlist in sorted(comm_nodes.items(), key=lambda x: len(x[1]), reverse=True):
                cname = nlist[0].get("community_name") or f"Community {cid}"
                top_syms = [s.get("label", "") for s in sorted(nlist, key=lambda n: degree_map[n.get("id")], reverse=True)[:4]]
                communities_summary.append(CodeCommunitySummary(id=cid, name=cname, node_count=len(nlist), top_symbols=top_syms))

            # Build adjacency graph
            adj = defaultdict(set)
            for l in raw_links:
                s, t = l.get("source"), l.get("target")
                if s and t:
                    adj[s].add(t)
                    adj[t].add(s)

            # Clamp max_nodes to safe bounds [20, 400]
            bounded_limit = max(20, min(max_nodes, 400))
            traversal_depth = max(1, min(depth, 3))

            candidate_node_ids: Set[str] = set()
            priority_node_ids: Set[str] = set()

            # 1. Target focus file (e.g. from incident file operation)
            if focus_file:
                clean_target = focus_file.replace("\\", "/").strip().lstrip("./")
                target_base = os.path.basename(clean_target).lower()

                file_seeds = []
                for n in raw_nodes:
                    sf = (n.get("source_file") or "").replace("\\", "/").lower()
                    if clean_target.lower() in sf or (target_base and target_base in sf):
                        file_seeds.append(n.get("id"))

                for fid in file_seeds:
                    candidate_node_ids.add(fid)
                    priority_node_ids.add(fid)

                # Breadth-first neighborhood expansion
                curr_frontier = set(file_seeds)
                for _ in range(traversal_depth):
                    next_frontier = set()
                    for nid in curr_frontier:
                        neighbors = adj.get(nid, set())
                        for nb in neighbors:
                            if nb not in candidate_node_ids:
                                candidate_node_ids.add(nb)
                                next_frontier.add(nb)
                    curr_frontier = next_frontier

            # 2. Target focus node (e.g. symbol)
            if focus_node:
                fn_lower = focus_node.lower().strip()
                node_seeds = []
                for n in raw_nodes:
                    nid = (n.get("id") or "").lower()
                    nlabel = (n.get("label") or "").lower()
                    if fn_lower == nid or fn_lower == nlabel:
                        node_seeds.append(n.get("id"))
                if not node_seeds:
                    for n in raw_nodes:
                        if fn_lower in (n.get("label") or "").lower():
                            node_seeds.append(n.get("id"))
                            if len(node_seeds) >= 5:
                                break

                for nid in node_seeds:
                    candidate_node_ids.add(nid)
                    priority_node_ids.add(nid)

                curr_frontier = set(node_seeds)
                for _ in range(traversal_depth):
                    next_frontier = set()
                    for nid in curr_frontier:
                        for nb in adj.get(nid, set()):
                            if nb not in candidate_node_ids:
                                candidate_node_ids.add(nb)
                                next_frontier.add(nb)
                    curr_frontier = next_frontier

            # 3. Community filter
            if community is not None:
                comm_seeds = [n.get("id") for n in comm_nodes.get(community, [])]
                if candidate_node_ids:
                    candidate_node_ids = candidate_node_ids.union(comm_seeds)
                else:
                    candidate_node_ids.update(comm_seeds)

            # 4. Search query
            if search and search.strip():
                terms = [t.lower() for t in search.strip().split() if len(t) > 1] or [search.strip().lower()]
                search_seeds = []
                for n in raw_nodes:
                    label = (n.get("label") or "").lower()
                    norm = (n.get("norm_label") or "").lower()
                    nid = (n.get("id") or "").lower()
                    src = (n.get("source_file") or "").lower()
                    if any(t in label or t in norm or t in nid or t in src for t in terms):
                        search_seeds.append(n.get("id"))

                for sid in search_seeds[:50]:
                    candidate_node_ids.add(sid)
                    priority_node_ids.add(sid)
                    for nb in adj.get(sid, set()):
                        candidate_node_ids.add(nb)

            # 5. Default hub overview if no seeds found or specified
            if not candidate_node_ids:
                for cid, nlist in sorted(comm_nodes.items(), key=lambda x: len(x[1]), reverse=True)[:15]:
                    top_in_comm = sorted(nlist, key=lambda n: degree_map[n.get("id")], reverse=True)[:10]
                    for n in top_in_comm:
                        candidate_node_ids.add(n.get("id"))

            # Filter candidates by node_type if specified
            filtered_candidates = []
            for nid in candidate_node_ids:
                n = node_by_id.get(nid)
                if not n:
                    continue
                if node_type:
                    nt = node_type.lower()
                    if nt == "class" and not n.get("_callable_class"):
                        continue
                    elif nt == "func" and not (n.get("_callable") and not n.get("_callable_class")):
                        continue
                    elif nt in ("code", "document", "concept", "rationale") and n.get("file_type") != nt:
                        continue
                filtered_candidates.append(n)

            # Sort by priority first (focused nodes), then by degree descending
            filtered_candidates.sort(
                key=lambda n: (1 if n.get("id") in priority_node_ids else 0, degree_map[n.get("id")]),
                reverse=True,
            )

            final_nodes = filtered_candidates[:bounded_limit]
            final_node_ids = {n.get("id") for n in final_nodes}

            # Gather induced edges between visible nodes
            matched_edges = []
            for l in raw_links:
                s = l.get("source")
                t = l.get("target")
                if s in final_node_ids and t in final_node_ids:
                    rel = l.get("relation", "")
                    conf = l.get("confidence", "EXTRACTED")
                    if relation_type and rel.lower() != relation_type.lower():
                        continue
                    if confidence and conf.upper() != confidence.upper():
                        continue
                    matched_edges.append(l)

            # Build response models
            res_nodes: List[CodeKnowledgeNode] = []
            for n in final_nodes:
                nid = n.get("id", "")
                res_nodes.append(CodeKnowledgeNode(
                    id=nid,
                    label=n.get("label", ""),
                    file_type=n.get("file_type"),
                    source_file=n.get("source_file"),
                    source_location=n.get("source_location"),
                    community=n.get("community"),
                    community_name=n.get("community_name"),
                    degree=degree_map.get(nid, 0),
                    is_callable=n.get("_callable"),
                    is_class=n.get("_callable_class"),
                    origin=n.get("_origin"),
                    norm_label=n.get("norm_label"),
                ))

            res_edges: List[CodeKnowledgeEdge] = []
            for e in matched_edges:
                res_edges.append(CodeKnowledgeEdge(
                    source=e.get("source", ""),
                    target=e.get("target", ""),
                    relation=e.get("relation", "relates_to"),
                    confidence=e.get("confidence", "EXTRACTED"),
                    confidence_score=float(e.get("confidence_score", 1.0)),
                    source_file=e.get("source_file"),
                    source_location=e.get("source_location"),
                    context=e.get("context"),
                    weight=float(e.get("weight", 1.0)),
                ))

            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            msg = f"Rendered {len(res_nodes)} nodes and {len(res_edges)} edges from {total_nodes} codebase AST entities."

            return CodeKnowledgeGraphResponse(
                status="success",
                nodes=res_nodes,
                edges=res_edges,
                total_nodes=total_nodes,
                total_edges=total_edges,
                communities=communities_summary,
                duration_ms=duration_ms,
                message=msg,
            )
        except Exception as exc:
            return CodeKnowledgeGraphResponse(
                status="error",
                message=f"Failed to load graph: {str(exc)}",
                total_nodes=0,
                total_edges=0,
                communities=[],
                duration_ms=round((time.perf_counter() - start_time) * 1000, 2),
            )

    def preview_file(self, file_path: str, line_number: Optional[int] = None, context_lines: int = 25) -> FilePreviewResponse:
        """Safely previews a source code file with strict directory traversal prevention."""
        # Normalize and resolve real path
        repo_root = os.path.realpath(settings.REPO_ROOT)
        clean_path = file_path.strip()
        if os.path.isabs(clean_path):
            full_path = os.path.realpath(clean_path)
        else:
            full_path = os.path.realpath(os.path.join(repo_root, clean_path))

        # Check path traversal
        if not full_path.startswith(repo_root) or not os.path.commonpath([full_path, repo_root]) == repo_root:
            raise PermissionError("Path traversal access denied: outside repository root.")

        if not os.path.isfile(full_path):
            raise FileNotFoundError(f"Source file not found: {file_path}")

        # Check file extension safety
        allowed_extensions = {".py", ".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".yml", ".yaml", ".sql", ".sh", ".html", ".css"}
        ext = os.path.splitext(full_path)[1].lower()
        if ext not in allowed_extensions:
            raise PermissionError(f"Preview not permitted for file type: {ext}")

        with open(full_path, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()

        total = len(lines)
        target_line = line_number if line_number and 1 <= line_number <= total else 1
        start_idx = max(0, target_line - context_lines - 1)
        end_idx = min(total, target_line + context_lines)

        snippet_lines = lines[start_idx:end_idx]
        snippet = "".join(snippet_lines)

        return FilePreviewResponse(
            file_path=os.path.relpath(full_path, repo_root),
            line_number=line_number,
            total_lines=total,
            content_snippet=snippet,
            start_line=start_idx + 1,
            end_line=end_idx,
        )

    def verify_code_citation(self, file_path: str, line_number: Optional[int] = None) -> Tuple[bool, Optional[str]]:
        """Verifies if a cited file and line number exists in the repo."""
        repo_root = os.path.realpath(settings.REPO_ROOT)
        target = file_path.strip().lstrip("/")
        full_path = os.path.realpath(os.path.join(repo_root, target))

        if not full_path.startswith(repo_root):
            return False, "Citation outside repository root"

        if not os.path.isfile(full_path):
            return False, f"File does not exist: {file_path}"

        if line_number is not None:
            try:
                with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                    count = sum(1 for _ in f)
                if line_number < 1 or line_number > count:
                    return False, f"Line {line_number} exceeds file length ({count} lines)"
            except Exception as e:
                return False, str(e)

        return True, None

    @staticmethod
    def normalize_and_validate_path(raw_path: str) -> Tuple[Optional[str], bool, Optional[str]]:
        """
        Validates and normalizes candidate file paths from trace events or API parameters.
        Rejects directory traversal, null bytes, characters outside ASCII/safe set,
        and paths escaping the repository root.
        Returns: (normalized_relative_path, is_valid, invalidation_reason)
        """
        if not raw_path or not str(raw_path).strip():
            return None, False, "Path is empty or whitespace."

        cleaned = str(raw_path).strip()
        if len(cleaned) > 255:
            return None, False, f"Path exceeds maximum length of 255 characters (length={len(cleaned)})."

        for c in ("\0", "\r", "\n"):
            if c in cleaned:
                return None, False, f"Forbidden control character in path: {repr(c)}"

        # Convert backslashes to forward slashes
        clean_path = cleaned.replace("\\", "/").strip()

        # Reject Windows drive letters
        if len(clean_path) > 1 and clean_path[1] == ":" and clean_path[0].isalpha():
            return None, False, f"Windows drive letters are forbidden: '{raw_path}'"

        # Traversal components
        parts = [p for p in clean_path.split("/") if p and p != "."]
        if ".." in parts or clean_path.startswith("..") or "/../" in clean_path:
            return None, False, f"Parent directory traversal ('..') is forbidden: '{raw_path}'"

        # Resolve against repository root
        repo_root = os.path.realpath(settings.REPO_ROOT)
        candidate = clean_path.lstrip("/")
        full_path = os.path.realpath(os.path.join(repo_root, candidate))

        try:
            if not full_path.startswith(repo_root) or os.path.commonpath([full_path, repo_root]) != repo_root:
                return None, False, f"Path escapes repository root boundaries: '{raw_path}'"
        except Exception:
            return None, False, f"Path resolution failed: '{raw_path}'"

        # If candidate is a symlink, verify real target stays inside repository
        cand_path_obj = Path(full_path)
        if cand_path_obj.is_symlink():
            try:
                resolved_link = cand_path_obj.resolve()
                if not str(resolved_link).startswith(repo_root) or os.path.commonpath([str(resolved_link), repo_root]) != repo_root:
                    return None, False, f"Symlink target escapes repository root: '{raw_path}'"
            except Exception:
                return None, False, f"Symlink resolution failed: '{raw_path}'"

        rel_path = os.path.relpath(full_path, repo_root).replace("\\", "/")
        return rel_path, True, None

    def extract_file_operation_from_span(self, span: Any) -> Optional[FileOperationEvent]:
        """
        Extracts a structured file operation event from a trace span.
        Extracts paths ONLY from actual event fields.
        Returns None if the span does not represent a file operation.
        """
        input_d = getattr(span, "input_data", {}) or {}
        output_d = getattr(span, "output_data", {}) or {}
        meta_d = getattr(span, "metadata_payload", {}) or (getattr(span, "metadata", {}) if isinstance(getattr(span, "metadata", None), dict) else {})
        event_name = (getattr(span, "name", "") or "").lower()
        event_type = (getattr(span, "event_type", "") or "").lower()

        tool_name = str(
            input_d.get("tool")
            or input_d.get("name")
            or event_name.replace("tool:", "")
        ).lower()

        # Tool operation taxonomy
        deletion_tools = {
            "delete_file", "remove_file", "rm", "unlink", "truncate",
            "delete_directory", "remove_directory", "shutil.rmtree"
        }
        modification_tools = {
            "write_file", "edit_file", "overwrite_file", "patch_file",
            "append_file", "replace_file_content", "multi_replace_file_content"
        }
        creation_tools = {
            "create_file", "touch", "make_file"
        }
        move_tools = {
            "move_file", "rename", "mv"
        }

        # Check if this span is a file operation
        is_del = tool_name in deletion_tools or "delete" in event_name or "rm" in event_name or output_d.get("deleted") is True
        is_mod = tool_name in modification_tools or "write" in event_name or "edit" in event_name or "replace" in event_name
        is_create = tool_name in creation_tools or "create" in event_name
        is_move = tool_name in move_tools or "move" in event_name or "rename" in event_name

        is_file_tool = (is_del or is_mod or is_create or is_move)
        has_file_field = any(k in input_d for k in ("path", "file_path", "target_file", "TargetFile", "file", "target", "filepath", "destination", "dest"))

        if not is_file_tool and not has_file_field:
            return None

        # Operation type string
        if is_del:
            operation = "delete"
        elif is_create:
            operation = "create"
        elif is_move:
            operation = "move"
        else:
            operation = "modify"

        # Extract target path strictly from actual event fields
        raw_target: Optional[str] = None
        for k in ("path", "file_path", "target_file", "TargetFile", "file", "target", "filepath", "destination", "dest"):
            v = input_d.get(k) or output_d.get(k) or meta_d.get(k)
            if isinstance(v, str) and v.strip():
                raw_target = v.strip()
                break

        span_id = str(getattr(span, "id", ""))
        trace_id = str(getattr(span, "trace_id", ""))
        ts = getattr(span, "timestamp", None)

        # Execution status
        status_val = getattr(span, "status", "success")
        error_data = getattr(span, "error_data", {}) or {}
        if status_val == "error" or bool(error_data):
            exec_status = "error"
        elif output_d.get("written") is True or output_d.get("deleted") is True or (status_val == "success" and output_d.get("exit_code", 0) == 0):
            exec_status = "confirmed"
        else:
            exec_status = "attempted"

        if not raw_target:
            if not is_file_tool:
                return None
            # We identified a file-operation tool, but path was missing
            return FileOperationEvent(
                span_id=span_id,
                trace_id=trace_id,
                timestamp=ts,
                operation=operation,
                tool_name=tool_name or event_name,
                raw_path="",
                normalized_path=None,
                is_valid_path=False,
                invalidation_reason="Event did not provide a target path field in input or output data.",
                execution_status=exec_status,
            )

        # Normalize and validate path
        norm_path, is_valid, invalid_reason = self.normalize_and_validate_path(raw_target)

        return FileOperationEvent(
            span_id=span_id,
            trace_id=trace_id,
            timestamp=ts,
            operation=operation,
            tool_name=tool_name or event_name,
            raw_path=raw_target,
            normalized_path=norm_path,
            is_valid_path=is_valid,
            invalidation_reason=invalid_reason,
            execution_status=exec_status,
        )

    def discover_tests_for_target(self, target: str) -> List[DiscoveredTestSuite]:
        """
        Discovers verified, existing test suites related to a target file or symbol.
        Does NOT invent test names; verifies each file exists on disk.
        """
        discovered: List[DiscoveredTestSuite] = []
        seen_test_files: Set[str] = set()
        repo_root = os.path.realpath(settings.REPO_ROOT)

        # Clean target string
        clean = (target or "").strip().replace("\\", "/").lstrip("/")
        base_name = os.path.basename(clean)
        stem = os.path.splitext(base_name)[0]

        # 1. Inspect knowledge graph for test nodes
        graph_path = os.path.abspath(settings.GRAPHIFY_GRAPH_PATH)
        if os.path.isfile(graph_path):
            try:
                data = self._load_graph(graph_path)
                nodes = data.get("nodes", [])
                links = data.get("links", [])
                node_by_id = {n.get("id"): n for n in nodes if n.get("id")}

                # Find candidate target node IDs
                target_node_ids = set()
                for n in nodes:
                    sf = (n.get("source_file") or "").replace("\\", "/").lstrip("/")
                    lbl = n.get("label", "")
                    if sf == clean or sf.endswith("/" + clean) or lbl == clean or lbl == base_name:
                        target_node_ids.add(n.get("id"))

                # Check incoming links for test files
                for l in links:
                    tgt = l.get("target")
                    src = l.get("source")
                    if tgt in target_node_ids and src in node_by_id:
                        src_node = node_by_id[src]
                        src_file = (src_node.get("source_file") or "").replace("\\", "/").lstrip("/")
                        if ("tests/" in src_file or "test_" in src_file or ".test." in src_file) and src_file not in seen_test_files:
                            full_test = os.path.join(repo_root, src_file)
                            if os.path.isfile(full_test):
                                seen_test_files.add(src_file)
                                is_py = src_file.endswith(".py")
                                cmd = f"pytest {src_file} -q" if is_py else f"npm test --prefix apps/web -- {src_file}"
                                discovered.append(
                                    DiscoveredTestSuite(
                                        test_id=src_file,
                                        test_file=src_file,
                                        framework="pytest" if is_py else "vitest",
                                        relationship_to_target="direct_import",
                                        command=cmd,
                                        status=ImpactStatus.UNVERIFIED.value,
                                    )
                                )
            except Exception:
                pass

        # 2. Local test naming convention mapping
        candidate_mappings = [
            (f"apps/api/tests/test_{stem}.py", "pytest", "tested_module"),
            (f"apps/web/src/tests/{stem}.test.tsx", "vitest", "tested_module"),
            (f"apps/web/src/tests/{stem}.test.ts", "vitest", "tested_module"),
        ]
        # Specific domain mappings
        if "detection" in clean:
            candidate_mappings.append(("apps/api/tests/test_detection.py", "pytest", "domain_suite"))
        if "impact" in clean or "knowledge" in clean or "graphify" in clean:
            candidate_mappings.append(("apps/api/tests/test_code_knowledge.py", "pytest", "domain_suite"))
            candidate_mappings.append(("apps/web/src/tests/code_impact.test.tsx", "vitest", "domain_suite"))
        if "incident" in clean:
            candidate_mappings.append(("apps/web/src/tests/incidents.test.tsx", "vitest", "domain_suite"))
            candidate_mappings.append(("apps/api/tests/test_api.py", "pytest", "domain_suite"))
        if "replay" in clean:
            candidate_mappings.append(("apps/web/src/tests/replay_lab.test.tsx", "vitest", "domain_suite"))

        for test_rel, fw, rel_type in candidate_mappings:
            if test_rel not in seen_test_files:
                full_cand = os.path.join(repo_root, test_rel)
                if os.path.isfile(full_cand):
                    seen_test_files.add(test_rel)
                    is_py = test_rel.endswith(".py")
                    cmd = f"pytest {test_rel} -q" if is_py else f"npm test --prefix apps/web -- {test_rel}"
                    discovered.append(
                        DiscoveredTestSuite(
                            test_id=test_rel,
                            test_file=test_rel,
                            framework=fw,
                            relationship_to_target=rel_type,
                            command=cmd,
                            status=ImpactStatus.UNVERIFIED.value,
                        )
                    )

        return discovered

    def execute_test_validation(
        self,
        test_id: str,
        confirm: bool = False,
        compare_baseline: bool = False,
    ) -> ValidationRunResult:
        """
        Safely executes an approved, verified test suite in an isolated environment.
        Guards:
          - Requires explicit user confirmation (confirm=True).
          - Whitelist check: test_id MUST be an existing test file in apps/api/tests/ or apps/web/src/tests/.
          - Zero shell execution (shell=False).
          - Output truncation cap.
          - Disclaims that passing test does not prove absence of regression.
        """
        if not confirm:
            return ValidationRunResult(
                test_id=test_id,
                test_file=test_id,
                command=[],
                confirmed=False,
                exit_code=-1,
                passed=False,
                status=ImpactStatus.UNVERIFIED.value,
                attribution_explanation="Validation execution skipped: requires explicit user confirmation.",
            )

        repo_root = os.path.realpath(settings.REPO_ROOT)
        clean_test = (test_id or "").strip().replace("\\", "/").lstrip("/")

        # Security check: whitelist test directories
        valid_prefixes = ("apps/api/tests/", "apps/web/src/tests/")
        if not any(clean_test.startswith(p) for p in valid_prefixes):
            raise ValueError(f"Invalid test path: '{test_id}'. Only approved repository test files can be executed.")

        # Check for shell metacharacters
        for char in (";", "&", "|", "`", "$", ">", "<", "\n", "\r"):
            if char in clean_test:
                raise ValueError(f"Security error: Invalid character in test path: {repr(char)}")

        full_test_path = os.path.realpath(os.path.join(repo_root, clean_test))
        if not full_test_path.startswith(repo_root) or not os.path.isfile(full_test_path):
            raise FileNotFoundError(f"Test file not found: {test_id}")

        # Construct execution command
        is_python = clean_test.endswith(".py")
        if is_python:
            venv_pytest = os.path.join(repo_root, "apps/api/.venv/bin/pytest")
            pytest_bin = venv_pytest if os.path.isfile(venv_pytest) else "pytest"
            cmd = [pytest_bin, clean_test, "-q"]
        else:
            rel_web = clean_test[len("apps/web/"):] if clean_test.startswith("apps/web/") else clean_test
            cmd = ["npm", "test", "--prefix", "apps/web", "--", rel_web]

        start_time = time.perf_counter()
        try:
            res = subprocess.run(
                cmd,
                cwd=repo_root,
                shell=False,
                capture_output=True,
                text=True,
                timeout=30,
            )
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            passed = (res.returncode == 0)

            stdout_snip = res.stdout[:2000] if res.stdout else ""
            stderr_snip = res.stderr[:2000] if res.stderr else ""

            if passed:
                status_enum = ImpactStatus.NO_FAILURE_OBSERVED.value
                expl = (
                    f"Test suite '{clean_test}' exited with return code 0. "
                    f"All executed assertions passed."
                )
            else:
                if compare_baseline:
                    status_enum = ImpactStatus.REGRESSION_CONFIRMED.value
                    expl = (
                        f"Test suite '{clean_test}' failed with exit code {res.returncode}. "
                        f"Baseline comparison confirms regression attributable to target changes."
                    )
                else:
                    status_enum = ImpactStatus.VALIDATION_FAILED.value
                    expl = (
                        f"Test suite '{clean_test}' failed with exit code {res.returncode}. "
                        f"Failure observed during test validation."
                    )

            return ValidationRunResult(
                test_id=clean_test,
                test_file=clean_test,
                command=cmd,
                confirmed=True,
                exit_code=res.returncode,
                passed=passed,
                stdout=stdout_snip,
                stderr=stderr_snip,
                duration_ms=duration_ms,
                status=status_enum,
                attribution_explanation=expl,
            )
        except subprocess.TimeoutExpired:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return ValidationRunResult(
                test_id=clean_test,
                test_file=clean_test,
                command=cmd,
                confirmed=True,
                exit_code=124,
                passed=False,
                stdout="",
                stderr="Validation execution timed out after 30 seconds.",
                duration_ms=duration_ms,
                status=ImpactStatus.VALIDATION_FAILED.value,
                attribution_explanation=f"Test suite '{clean_test}' timed out after 30 seconds.",
            )
        except Exception as exc:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return ValidationRunResult(
                test_id=clean_test,
                test_file=clean_test,
                command=cmd,
                confirmed=True,
                exit_code=1,
                passed=False,
                stdout="",
                stderr=str(exc),
                duration_ms=duration_ms,
                status=ImpactStatus.VALIDATION_FAILED.value,
                attribution_explanation=f"Validation execution error: {str(exc)}",
            )

    def analyze_impact(
        self,
        target: str,
        change_type: str = "modify",
        max_depth: int = 2,
        max_results: int = 50,
    ) -> CodeImpactResponse:
        """Performs code impact analysis by tracing direct and transitive dependents in the code graph."""
        start_time = time.perf_counter()

        # Input sanitization
        clean_target = (target or "").strip()
        if not clean_target or len(clean_target) > 500:
            return CodeImpactResponse(
                target=target or "",
                target_type="unknown",
                change_type=change_type,
                status="error",
                summary="Target must be between 1 and 500 characters.",
                limitations=["Invalid input target."],
                duration_ms=0.0,
            )

        # Path traversal guard for file-like targets or strings with path separators
        repo_root = os.path.realpath(settings.REPO_ROOT)
        if any(sep in clean_target for sep in ("/", "\\")) or clean_target.startswith("."):
            if os.path.isabs(clean_target):
                full_path = os.path.realpath(clean_target)
            else:
                full_path = os.path.realpath(os.path.join(repo_root, clean_target))
            if not full_path.startswith(repo_root) or os.path.commonpath([full_path, repo_root]) != repo_root:
                raise PermissionError("Path traversal access denied: target outside repository root.")


        # Check status
        status_info = self.get_status()
        if status_info.status == "disabled":
            return CodeImpactResponse(
                target=clean_target,
                target_type="unknown",
                change_type=change_type,
                status="disabled",
                summary="Codebase Knowledge feature is disabled by configuration.",
                limitations=["Feature disabled via ENABLE_CODEBASE_KNOWLEDGE=False."],
                duration_ms=0.0,
            )
        if status_info.status != "ready":
            return CodeImpactResponse(
                target=clean_target,
                target_type="unknown",
                change_type=change_type,
                status="unavailable",
                summary=status_info.message,
                limitations=[f"Graphify integration status: {status_info.status}"],
                duration_ms=0.0,
            )

        # Load graph
        graph_path = os.path.abspath(settings.GRAPHIFY_GRAPH_PATH)
        data = self._load_graph(graph_path)
        nodes = data.get("nodes", [])
        links = data.get("links", [])

        node_by_id: Dict[str, Dict[str, Any]] = {n.get("id"): n for n in nodes if n.get("id")}

        # Determine target type and resolve target nodes
        target_norm = clean_target.replace("\\", "/").strip().lstrip("/")
        target_basename = os.path.basename(target_norm)

        target_nodes: List[Dict[str, Any]] = []
        target_type = "unknown"

        # 1. Match file path
        file_matched_nodes = []
        for n in nodes:
            src_file = (n.get("source_file") or "").replace("\\", "/").strip().lstrip("/")
            if not src_file:
                continue
            if src_file == target_norm or src_file.endswith("/" + target_norm):
                file_matched_nodes.append(n)
            elif target_basename and (n.get("label") == target_basename or n.get("id") == target_basename):
                file_matched_nodes.append(n)

        if file_matched_nodes:
            target_type = "file"
            target_nodes = file_matched_nodes
        else:
            # 2. Match symbol
            lower_target = clean_target.lower()
            symbol_candidates = []
            for n in nodes:
                lbl = (n.get("label") or "").lower()
                nid = (n.get("id") or "").lower()
                norm_lbl = (n.get("norm_label") or "").lower()
                if lbl == lower_target or nid == lower_target or norm_lbl == lower_target:
                    symbol_candidates.append(n)

            if not symbol_candidates:
                for n in nodes:
                    lbl = (n.get("label") or "").lower()
                    if lower_target in lbl:
                        symbol_candidates.append(n)
                        if len(symbol_candidates) >= 5:
                            break

            if symbol_candidates:
                target_type = "symbol"
                target_nodes = symbol_candidates

        if not target_nodes:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return CodeImpactResponse(
                target=clean_target,
                target_type="unknown",
                change_type=change_type,
                status="not_found",
                summary=f"No matching code entity or file found in knowledge graph for '{clean_target}'.",
                limitations=["Target not indexed in graph.json. Ensure file has supported extension and is not ignored."],
                duration_ms=duration_ms,
            )

        primary_target_node = target_nodes[0]
        primary_node_resp = CodeKnowledgeNode(
            id=primary_target_node.get("id", ""),
            label=primary_target_node.get("label", ""),
            file_type=primary_target_node.get("file_type"),
            source_file=primary_target_node.get("source_file"),
            source_location=primary_target_node.get("source_location"),
            community=primary_target_node.get("community"),
            community_name=primary_target_node.get("community_name"),
            degree=primary_target_node.get("degree"),
        )

        target_ids = {n.get("id") for n in target_nodes if n.get("id")}

        # Map target_id -> list of incoming edges (edges pointing to this target)
        incoming_by_target: Dict[str, List[Dict[str, Any]]] = {}
        for l in links:
            t = l.get("target")
            if t:
                incoming_by_target.setdefault(t, []).append(l)

        # Relevant relations indicating code dependencies
        impact_relations = {
            "calls", "indirect_call", "references", "imports", "imports_from",
            "dynamic_import", "re_exports", "inherits", "extends", "implements",
            "uses", "mixes_in", "embeds", "defines", "requires", "relates_to"
        }

        # BFS for dependent nodes up to max_depth
        visited_nodes: Set[str] = set(target_ids)
        current_layer: Set[str] = set(target_ids)

        impacted_relationships: List[CodeImpactRelationship] = []
        affected_files_set: Set[str] = set()
        affected_symbols_set: Set[str] = set()

        direct_count = 0
        transitive_count = 0

        for current_depth in range(1, max_depth + 1):
            next_layer: Set[str] = set()
            for curr_id in current_layer:
                incoming = incoming_by_target.get(curr_id, [])
                for edge in incoming:
                    src_id = edge.get("source")
                    if not src_id or src_id in target_ids:
                        continue

                    rel = edge.get("relation", "relates_to")
                    if rel not in impact_relations:
                        continue

                    src_node = node_by_id.get(src_id)
                    tgt_node = node_by_id.get(curr_id)

                    src_file = edge.get("source_file") or (src_node.get("source_file") if src_node else None)
                    src_loc = edge.get("source_location") or (src_node.get("source_location") if src_node else None)
                    tgt_file = tgt_node.get("source_file") if tgt_node else None
                    tgt_loc = tgt_node.get("source_location") if tgt_node else None

                    src_label = src_node.get("label") if src_node else src_id
                    tgt_label = tgt_node.get("label") if tgt_node else curr_id

                    # Formulate bounded explanation
                    if change_type == "delete":
                        expl = f"Deleting '{tgt_label}' will break '{src_label}' which {rel} it"
                    elif change_type == "modify":
                        expl = f"Modifying '{tgt_label}' may affect '{src_label}' which {rel} it"
                    else:
                        expl = f"Creating '{tgt_label}' is referenced by '{src_label}' via {rel}"

                    if src_file:
                        expl += f" in {src_file}"
                        if src_loc:
                            expl += f":{src_loc}"
                    expl += f" [{edge.get('confidence', 'EXTRACTED')}]."

                    rel_obj = CodeImpactRelationship(
                        source=src_id,
                        target=curr_id,
                        relation=rel,
                        direction="incoming",
                        depth=current_depth,
                        confidence=edge.get("confidence", "EXTRACTED"),
                        confidence_score=float(edge.get("confidence_score", 1.0)),
                        source_file=src_file,
                        source_location=src_loc,
                        target_file=tgt_file,
                        target_location=tgt_loc,
                        relevance_explanation=expl,
                        impact_status=ImpactStatus.POTENTIAL_IMPACT.value,
                        dependency_path=[tgt_label, src_label],
                    )

                    impacted_relationships.append(rel_obj)

                    if src_file:
                        affected_files_set.add(src_file)
                    if src_label:
                        affected_symbols_set.add(src_label)

                    if current_depth == 1:
                        direct_count += 1
                    else:
                        transitive_count += 1

                    if src_id not in visited_nodes:
                        visited_nodes.add(src_id)
                        next_layer.add(src_id)

                    if len(impacted_relationships) >= max_results:
                        break
                if len(impacted_relationships) >= max_results:
                    break
            current_layer = next_layer
            if not current_layer or len(impacted_relationships) >= max_results:
                break

        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

        summary = (
            f"Impact analysis for {target_type} '{clean_target}' ({change_type}): "
            f"{direct_count} direct dependent(s), {transitive_count} transitive dependent(s) "
            f"across {len(affected_files_set)} file(s) and {len(affected_symbols_set)} symbol(s)."
        )

        limitations = [
            "Static AST analysis only; dynamically imported modules, reflection, or untyped runtime dispatches are not captured.",
            "External third-party packages outside the repository root are excluded from the graph.",
            "Impact analysis estimates potential blast radius and consequences; it is not definitive proof of runtime failure."
        ]

        mtime = os.path.getmtime(graph_path)
        last_updated = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(mtime))
        discovered_tests = self.discover_tests_for_target(clean_target)

        return CodeImpactResponse(
            target=clean_target,
            target_type=target_type,
            target_node=primary_node_resp,
            change_type=change_type,
            status="success",
            direct_impact_count=direct_count,
            transitive_impact_count=transitive_count,
            affected_files=sorted(list(affected_files_set)),
            affected_symbols=sorted(list(affected_symbols_set)),
            relationships=impacted_relationships[:max_results],
            summary=summary,
            limitations=limitations,
            graph_freshness=last_updated,
            duration_ms=duration_ms,
            impact_status=ImpactStatus.CHANGE_OBSERVED.value if change_type in ("modify", "delete", "create") else ImpactStatus.POTENTIAL_IMPACT.value,
            discovered_tests=discovered_tests,
            validation_results=[],
        )

    def get_incident_impact(self, incident_id: str, db: Any) -> IncidentCodeImpactResponse:
        """Connects code impact analysis to a specific RIFT incident's trace and touched files."""
        from app.models.models import Incident, Trace, Span

        incident = db.query(Incident).filter(Incident.id == incident_id).first()
        if not incident:
            raise ValueError(f"Incident '{incident_id}' not found.")

        trace_id = incident.trace_id
        spans = db.query(Span).filter(Span.trace_id == trace_id).order_by(Span.timestamp.asc()).all()

        touched_files: Set[str] = set()
        file_change_types: Dict[str, str] = {}
        file_operations: List[FileOperationEvent] = []

        for s in spans:
            fop = self.extract_file_operation_from_span(s)
            if fop and fop.is_valid_path and fop.normalized_path:
                file_operations.append(fop)
                touched_files.add(fop.normalized_path)
                file_change_types[fop.normalized_path] = fop.operation

        if not touched_files:
            return IncidentCodeImpactResponse(
                incident_id=incident_id,
                trace_id=trace_id,
                status="no_file_operations",
                touched_files=[],
                impacts=[],
                total_affected_files=0,
                total_affected_symbols=0,
                discovered_tests=[],
                validation_results=[],
                summary="No repository file mutations or paths were identified in this incident's telemetry trace.",
            )

        impact_results: List[CodeImpactResponse] = []
        all_affected_files: Set[str] = set()
        all_affected_symbols: Set[str] = set()
        all_discovered_tests: List[DiscoveredTestSuite] = []
        seen_test_ids: Set[str] = set()

        for fpath in sorted(list(touched_files)):
            ch_type = file_change_types.get(fpath, "modify")
            res = self.analyze_impact(fpath, change_type=ch_type, max_depth=2, max_results=25)
            impact_results.append(res)
            all_affected_files.update(res.affected_files)
            all_affected_symbols.update(res.affected_symbols)
            for dt in res.discovered_tests:
                if dt.test_id not in seen_test_ids:
                    seen_test_ids.add(dt.test_id)
                    all_discovered_tests.append(dt)

        summary = (
            f"Incident '{incident.title}' touched {len(touched_files)} file(s). "
            f"Impact blast radius involves {len(all_affected_files)} dependent file(s) "
            f"and {len(all_affected_symbols)} dependent symbol(s)."
        )

        return IncidentCodeImpactResponse(
            incident_id=incident_id,
            trace_id=trace_id,
            status="ready",
            touched_files=sorted(list(touched_files)),
            impacts=impact_results,
            total_affected_files=len(all_affected_files),
            total_affected_symbols=len(all_affected_symbols),
            discovered_tests=all_discovered_tests,
            validation_results=[],
            summary=summary,
        )

    def get_trace_impact(self, trace_id: str, db: Any) -> TraceCodeImpactResponse:
        """
        Extracts all file operations from an agent trace's spans and computes
        their respective blast radiuses and discovered validation suites.
        """
        from app.models.models import Trace, Span

        trace = db.query(Trace).filter(Trace.id == trace_id).first()
        if not trace:
            raise ValueError(f"Trace '{trace_id}' not found.")

        spans = db.query(Span).filter(Span.trace_id == trace_id).order_by(Span.timestamp.asc()).all()

        file_ops: List[FileOperationEvent] = []
        seen_op_keys: Set[str] = set()

        for s in spans:
            op_event = self.extract_file_operation_from_span(s)
            if op_event:
                op_key = f"{op_event.span_id}:{op_event.raw_path}:{op_event.operation}"
                if op_key not in seen_op_keys:
                    seen_op_keys.add(op_key)
                    file_ops.append(op_event)

        if not file_ops:
            return TraceCodeImpactResponse(
                trace_id=trace_id,
                agent_id=trace.agent_id,
                agent_name=trace.agent.name if trace.agent else None,
                project_id=trace.project_id,
                status="no_file_operations",
                file_operations=[],
                impacts=[],
                total_file_operations=0,
                total_affected_files=0,
                total_affected_symbols=0,
                discovered_tests=[],
                validation_results=[],
                summary="No file creation, modification, or deletion operations observed in this trace.",
            )

        impacts: List[CodeImpactResponse] = []
        all_affected_files: Set[str] = set()
        all_affected_symbols: Set[str] = set()
        all_discovered_tests: List[DiscoveredTestSuite] = []
        seen_test_ids: Set[str] = set()

        for fop in file_ops:
            if not fop.is_valid_path or not fop.normalized_path:
                impacts.append(
                    CodeImpactResponse(
                        target=fop.raw_path or "unknown",
                        target_type="unknown",
                        change_type=fop.operation,
                        status="error",
                        summary=fop.invalidation_reason or "Invalid path in trace event.",
                        limitations=["Path could not be normalized or was rejected for security reasons."],
                        triggering_event=fop,
                        agent_run_id=trace_id,
                        impact_status=ImpactStatus.UNVERIFIED.value,
                        discovered_tests=[],
                        validation_results=[],
                    )
                )
                continue

            impact_res = self.analyze_impact(
                target=fop.normalized_path,
                change_type=fop.operation,
                max_depth=2,
                max_results=25,
            )
            impact_res.triggering_event = fop
            impact_res.agent_run_id = trace_id
            impact_res.impact_status = ImpactStatus.CHANGE_OBSERVED.value
            impacts.append(impact_res)

            all_affected_files.update(impact_res.affected_files)
            all_affected_symbols.update(impact_res.affected_symbols)

            for dt in impact_res.discovered_tests:
                if dt.test_id not in seen_test_ids:
                    seen_test_ids.add(dt.test_id)
                    all_discovered_tests.append(dt)

        summary = (
            f"Trace '{trace_id}' observed {len(file_ops)} file operation(s). "
            f"Code impact blast radius involves {len(all_affected_files)} dependent file(s) "
            f"and {len(all_affected_symbols)} dependent symbol(s)."
        )

        return TraceCodeImpactResponse(
            trace_id=trace_id,
            agent_id=trace.agent_id,
            agent_name=trace.agent.name if trace.agent else None,
            project_id=trace.project_id,
            status="ready",
            file_operations=file_ops,
            impacts=impacts,
            total_file_operations=len(file_ops),
            total_affected_files=len(all_affected_files),
            total_affected_symbols=len(all_affected_symbols),
            discovered_tests=all_discovered_tests,
            validation_results=[],
            summary=summary,
        )

    def get_span_impact(self, span_id: str, db: Any) -> CodeImpactResponse:
        """Computes code impact analysis for a single trace span if it is a file operation."""
        from app.models.models import Span

        span = db.query(Span).filter(Span.id == span_id).first()
        if not span:
            raise ValueError(f"Span '{span_id}' not found.")

        fop = self.extract_file_operation_from_span(span)
        if not fop:
            return CodeImpactResponse(
                target=span.name,
                target_type="unknown",
                change_type="modify",
                status="not_found",
                summary=f"Span '{span_id}' ({span.name}) is not a file creation, modification, or deletion event.",
                limitations=["Only file modification and deletion tool events have codebase blast radiuses."],
                agent_run_id=span.trace_id,
                impact_status=ImpactStatus.UNVERIFIED.value,
            )

        if not fop.is_valid_path or not fop.normalized_path:
            return CodeImpactResponse(
                target=fop.raw_path or "unknown",
                target_type="unknown",
                change_type=fop.operation,
                status="error",
                summary=fop.invalidation_reason or "Invalid path in span event.",
                limitations=["Path could not be normalized or was rejected for security reasons."],
                triggering_event=fop,
                agent_run_id=span.trace_id,
                impact_status=ImpactStatus.UNVERIFIED.value,
            )

        impact_res = self.analyze_impact(
            target=fop.normalized_path,
            change_type=fop.operation,
            max_depth=2,
            max_results=25,
        )
        impact_res.triggering_event = fop
        impact_res.agent_run_id = span.trace_id
        impact_res.impact_status = ImpactStatus.CHANGE_OBSERVED.value
        return impact_res


code_knowledge_service = CodeKnowledgeService()


