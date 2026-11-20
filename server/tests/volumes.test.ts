import { describe, expect, it } from "vitest";
import { parseVolumesJson } from "../src/core/volumes";

describe("parseVolumesJson", () => {
  it("parsea la salida de PowerShell y normaliza los tipos", () => {
    const volumes = parseVolumesJson(
      '\uFEFF[{"DeviceID":"C:","VolumeName":"OS","DriveType":3,"FileSystem":"NTFS","Size":1000,"FreeSpace":400,"ProviderName":null},{"DeviceID":"G:","VolumeName":"Google Drive","DriveType":3,"FileSystem":"FAT32","Size":"500","FreeSpace":200,"ProviderName":null}]'
    );

    expect(volumes).toHaveLength(2);
    expect(volumes[0]).toMatchObject({
      id: "C:",
      name: "OS",
      mountPath: "C:\\",
      type: "fixed",
      totalBytes: 1000,
      freeBytes: 400,
      usedBytes: 600,
      ready: true
    });
    expect(volumes[1]).toMatchObject({
      id: "G:",
      name: "Google Drive",
      totalBytes: 500,
      freeBytes: 200,
      usedBytes: 300
    });
  });

  it("marca unidades sin tamaño como no listas", () => {
    const volumes = parseVolumesJson(
      '[{"DeviceID":"D:","VolumeName":null,"DriveType":2,"FileSystem":null,"Size":null,"FreeSpace":null}]'
    );

    expect(volumes[0]).toMatchObject({
      id: "D:",
      type: "removable",
      totalBytes: 0,
      freeBytes: 0,
      usedBytes: 0,
      ready: false
    });
  });

  it("acepta un único objeto y descarta entradas inválidas", () => {
    const volumes = parseVolumesJson(
      '[{"DeviceID":"C:","DriveType":3,"Size":10,"FreeSpace":5},{"DeviceID":"bad","Size":1}]'
    );
    expect(volumes).toHaveLength(1);
    expect(volumes[0]?.id).toBe("C:");
    expect(volumes[0]?.type).toBe("fixed");
  });
});
