using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.HighDefinition;

[RequireComponent(typeof(Camera))]
public class LBRenderer : MonoBehaviour
{
    private Camera cam;
    private HDAdditionalCameraData hdCameraData;
    private Volume volume;

    private void Awake()
    {
        cam = GetComponent<Camera>();
        
        // Get or add HD Additional Camera Data component
        hdCameraData = GetComponent<HDAdditionalCameraData>();
        if (hdCameraData == null)
        {
            hdCameraData = gameObject.AddComponent<HDAdditionalCameraData>();
        }

        // Get or add Volume component
        volume = GetComponent<Volume>();
        if (volume == null)
        {
            volume = gameObject.AddComponent<Volume>();
        }

        SetupCamera();
        SetupVolume();
    }

    private void SetupCamera()
    {
        // Set VolumeMask to LumiBrush layer
        int lumiBrushLayer = LayerMask.NameToLayer("LumiBrush");
        if (lumiBrushLayer == -1)
        {
            Debug.LogWarning("LumiBrush layer not found. Please create a layer named 'LumiBrush' in the Unity project.");
            return;
        }

        // Set the volume layer mask on HD Additional Camera Data
        hdCameraData.volumeLayerMask = 1 << lumiBrushLayer;
    }

    private void SetupVolume()
    {
        if (volume == null) return;

        // Configure Volume component
        volume.mode = VolumeMode.Global;
        volume.weight = 1f;
        volume.priority = 1f;
    }

    private void OnValidate()
    {
        // Ensure setup is done in editor as well
        if (cam == null)
        {
            cam = GetComponent<Camera>();
        }
        if (hdCameraData == null)
        {
            hdCameraData = GetComponent<HDAdditionalCameraData>();
        }
        if (volume == null)
        {
            volume = GetComponent<Volume>();
        }

        if (cam != null && hdCameraData != null && volume != null)
        {
            SetupCamera();
            SetupVolume();
        }
    }
}
