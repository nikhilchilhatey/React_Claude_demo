import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

const mockSignIn = vi.mocked(signInAction);
const mockSignUp = vi.mocked(signUpAction);
const mockGetAnonWorkData = vi.mocked(getAnonWorkData);
const mockClearAnonWork = vi.mocked(clearAnonWork);
const mockGetProjects = vi.mocked(getProjects);
const mockCreateProject = vi.mocked(createProject);

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "new-project-id" } as any);
  });

  test("returns signIn, signUp, and isLoading", () => {
    const { result } = renderHook(() => useAuth());

    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signUp).toBe("function");
    expect(result.current.isLoading).toBe(false);
  });

  describe("signIn", () => {
    test("sets isLoading to true during request and false after", async () => {
      let resolveSignIn!: (v: any) => void;
      mockSignIn.mockReturnValue(
        new Promise((res) => { resolveSignIn = res; })
      );

      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.signIn("user@example.com", "password123");
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveSignIn({ success: false, error: "Invalid credentials" });
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("returns the result from signInAction on failure", async () => {
      const failResult = { success: false, error: "Invalid credentials" };
      mockSignIn.mockResolvedValue(failResult);

      const { result } = renderHook(() => useAuth());

      let returned: any;
      await act(async () => {
        returned = await result.current.signIn("user@example.com", "wrong");
      });

      expect(returned).toEqual(failResult);
    });

    test("returns the result from signInAction on success", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      mockGetProjects.mockResolvedValue([{ id: "proj-1" } as any]);

      const { result } = renderHook(() => useAuth());

      let returned: any;
      await act(async () => {
        returned = await result.current.signIn("user@example.com", "password123");
      });

      expect(returned).toEqual({ success: true });
    });

    test("does not navigate if signIn fails", async () => {
      mockSignIn.mockResolvedValue({ success: false, error: "Bad credentials" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "wrong");
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    test("sets isLoading to false even when signInAction throws", async () => {
      mockSignIn.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("signUp", () => {
    test("sets isLoading to true during request and false after", async () => {
      let resolveSignUp!: (v: any) => void;
      mockSignUp.mockReturnValue(
        new Promise((res) => { resolveSignUp = res; })
      );

      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.signUp("new@example.com", "password123");
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveSignUp({ success: false, error: "Email taken" });
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("returns the result from signUpAction on failure", async () => {
      const failResult = { success: false, error: "Email already registered" };
      mockSignUp.mockResolvedValue(failResult);

      const { result } = renderHook(() => useAuth());

      let returned: any;
      await act(async () => {
        returned = await result.current.signUp("existing@example.com", "password123");
      });

      expect(returned).toEqual(failResult);
    });

    test("does not navigate if signUp fails", async () => {
      mockSignUp.mockResolvedValue({ success: false, error: "Email already registered" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("existing@example.com", "password123");
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    test("sets isLoading to false even when signUpAction throws", async () => {
      mockSignUp.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("user@example.com", "password123").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("handlePostSignIn — anonymous work exists", () => {
    const anonWork = {
      messages: [{ role: "user", content: "Hello" }],
      fileSystemData: { "/App.tsx": { type: "file", content: "export default () => <div/>" } },
    };

    beforeEach(() => {
      mockGetAnonWorkData.mockReturnValue(anonWork);
      mockSignIn.mockResolvedValue({ success: true });
      mockCreateProject.mockResolvedValue({ id: "anon-project-id" } as any);
    });

    test("creates a project with anon work and navigates to it", async () => {
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(mockCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: anonWork.messages,
          data: anonWork.fileSystemData,
        })
      );
      expect(mockPush).toHaveBeenCalledWith("/anon-project-id");
    });

    test("clears anonymous work after migrating it", async () => {
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(mockClearAnonWork).toHaveBeenCalled();
    });

    test("does not call getProjects when anon work exists", async () => {
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(mockGetProjects).not.toHaveBeenCalled();
    });
  });

  describe("handlePostSignIn — no anonymous work, existing projects", () => {
    beforeEach(() => {
      mockGetAnonWorkData.mockReturnValue(null);
      mockSignIn.mockResolvedValue({ success: true });
      mockGetProjects.mockResolvedValue([{ id: "existing-project" } as any, { id: "older-project" } as any]);
    });

    test("navigates to the most recent existing project", async () => {
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith("/existing-project");
      expect(mockCreateProject).not.toHaveBeenCalled();
    });
  });

  describe("handlePostSignIn — no anonymous work, no existing projects", () => {
    beforeEach(() => {
      mockGetAnonWorkData.mockReturnValue(null);
      mockSignIn.mockResolvedValue({ success: true });
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue({ id: "brand-new-project" } as any);
    });

    test("creates a new empty project and navigates to it", async () => {
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(mockCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [],
          data: {},
        })
      );
      expect(mockPush).toHaveBeenCalledWith("/brand-new-project");
    });
  });

  describe("handlePostSignIn — anon work exists but has no messages", () => {
    beforeEach(() => {
      mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
      mockSignIn.mockResolvedValue({ success: true });
      mockGetProjects.mockResolvedValue([{ id: "fallback-project" } as any]);
    });

    test("falls through to existing projects when anon messages list is empty", async () => {
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(mockCreateProject).not.toHaveBeenCalledWith(
        expect.objectContaining({ messages: [] })
      );
      expect(mockPush).toHaveBeenCalledWith("/fallback-project");
    });
  });

  describe("signUp triggers the same post-sign-in flow", () => {
    beforeEach(() => {
      mockSignUp.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([{ id: "signup-project" } as any]);
    });

    test("navigates to the most recent project after successful sign-up", async () => {
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@example.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith("/signup-project");
    });
  });
});
